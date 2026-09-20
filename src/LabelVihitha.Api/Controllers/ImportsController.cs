using ClosedXML.Excel;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Application.Features.Products;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Api.Controllers;

/// <summary>Bulk product upload via the Excel template. Admin/Inventory only.</summary>
[ApiController]
[Authorize(Roles = "Admin,Inventory")]
[Route("api/imports")]
public class ImportsController : ControllerBase
{
    private const long MaxBytes = 10 * 1024 * 1024;
    private const string XlsxType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private readonly IProductImportService _import;
    private readonly IApplicationDbContext _db;

    public ImportsController(IProductImportService import, IApplicationDbContext db)
    {
        _import = import;
        _db = db;
    }

    [HttpGet("products/template")]
    public async Task<IActionResult> Template(CancellationToken ct)
    {
        var vendors = await _db.Vendors.Where(v => v.IsActive).OrderBy(v => v.Name).Select(v => v.Name).ToListAsync(ct);
        var invs = await _db.Inventories.Where(i => i.IsActive).OrderBy(i => i.Name).Select(i => i.Name).ToListAsync(ct);
        var cats = await _db.Categories.Where(c => c.IsActive).OrderBy(c => c.Name).Select(c => c.Name).ToListAsync(ct);
        var subs = await _db.SubCategories.Where(s => s.IsActive).OrderBy(s => s.Category.Name).ThenBy(s => s.Name)
            .Select(s => s.Category.Name + " > " + s.Name).ToListAsync(ct);
        var owners = await _db.Owners.Where(o => o.IsActive).OrderBy(o => o.Name).Select(o => o.Name).ToListAsync(ct);

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Products");
        var headers = new[] { "Vendor", "Inventory", "Category", "Subcategory", "SKU", "Product Name",
            "Size", "Qty", "Rate per unit (INR)", "GST %", "Discount %", "Markup %", "Round (INR)",
            "Cost per unit (INR)", "Sale price (USD)", "Reorder Threshold", "Color", "Material", "Description", "Paid By (owner)" };
        for (int c = 0; c < headers.Length; c++)
        {
            var cell = ws.Cell(1, c + 1);
            cell.Value = headers[c];
            cell.Style.Font.Bold = true;
        }
        // Columns: Vendor, Inventory, Category, Subcat, SKU, Name, Size, Qty,
        //          Rate, GST%, Disc%, Markup%, Round, Cost(INR), Sale(USD), Reorder, Color, Material, Desc, PaidBy
        var examples = new object?[][]
        {
            // Rate-based pricing: leave Cost & Sale blank — they're computed from Rate + GST/Discount/Markup/Round.
            new object?[]{ "Shanthi NX","Inventory 2","Kurtis","","SNX-301","Anarkali Kurti 13001","M",2, 2000,5,0,50,100, "","", 1,"Maroon","Cotton","Same SKU repeats per size","" },
            new object?[]{ "Shanthi NX","Inventory 2","Kurtis","","SNX-301","Anarkali Kurti 13001","L",1, 2000,5,0,50,100, "","", 1,"Maroon","Cotton","","" },
            // Blank SKU → auto-generated from the vendor name (e.g. ANA-0001).
            new object?[]{ "Anaga","Inventory 2","Frocks","","","Patola Frock","One Size",3, 4100,5,0,50,100, "","", 1,"","","Leave SKU blank to auto-number","" },
            // Or set Cost/Sale directly (overrides the Rate math); pricing columns can be left blank.
            new object?[]{ "Anaga","Inventory 2","Sarees","","ANG-401","Kanjeevaram Silk","Free Size",1, "","","","","", 3200,60, 1,"","","","" },
        };
        for (int r = 0; r < examples.Length; r++)
            for (int c = 0; c < examples[r].Length; c++)
                ws.Cell(r + 2, c + 1).Value = XLCellValue.FromObject(examples[r][c]);
        ws.Columns().AdjustToContents();

        var guide = wb.Worksheets.Add("Guide");
        var lines = new[]
        {
            "How to use this template",
            "",
            "1. One row per SIZE. A product with M-2 and L-1 = two rows with the SAME SKU, Name and prices,",
            "   different Size and Qty. They become one product with per-size stock.",
            "2. No real size? Put 'One Size' in Size and the total in Qty.",
            "3. Vendor / Inventory / Category / Subcategory: use names from the 'Reference' tab. Missing ones",
            "   are created automatically on import. Subcategory is optional.",
            "",
            "PRICING — two ways, pick either per row:",
            "4a. Easiest: enter 'Rate per unit (INR)' (the price on the supplier bill) plus GST %, Discount %,",
            "    Markup % and Round (INR). Cost and Sale are then computed for you:",
            "      Cost = Rate x (1 + GST%) x (1 - Discount%)",
            "      Sale = Cost x (1 + Markup%), rounded to the nearest 'Round (INR)' (e.g. 100).",
            "    Leave 'Cost per unit (INR)' and 'Sale price (USD)' BLANK to use this.",
            "4b. Or set 'Cost per unit (INR)' and 'Sale price (USD)' directly — these OVERRIDE the Rate math,",
            "    and you can leave the Rate/GST/Discount/Markup/Round columns blank.",
            "   (All INR values are converted to USD at 95 on import; Sale price is entered in USD.)",
            "",
            "5. SKU: unique per product. LEAVE IT BLANK to auto-generate one from the vendor name",
            "   (e.g. 'Anaga' -> ANA-0001, ANA-0002 ...); each blank-SKU row becomes its own product.",
            "   A SKU that already exists is skipped and reported.",
            "6. Paid By (owner): which partner's money funded this stock. Use an exact name from the",
            "   'Reference' tab. Owners are NOT auto-created — an unknown name imports the product",
            "   without an owner and is reported. Leave blank for jointly-funded stock.",
        };
        for (int i = 0; i < lines.Length; i++) guide.Cell(i + 1, 1).Value = lines[i];
        guide.Cell(1, 1).Style.Font.Bold = true;
        guide.Column(1).Width = 100;

        var refSheet = wb.Worksheets.Add("Reference");
        var refHeaders = new[] { "Vendors", "Inventories", "Categories", "Subcategories (Category > Sub)", "Owners" };
        for (int c = 0; c < refHeaders.Length; c++) { refSheet.Cell(1, c + 1).Value = refHeaders[c]; refSheet.Cell(1, c + 1).Style.Font.Bold = true; }
        void Fill(int col, List<string> vals) { for (int i = 0; i < vals.Count; i++) refSheet.Cell(i + 2, col).Value = vals[i]; }
        Fill(1, vendors); Fill(2, invs); Fill(3, cats); Fill(4, subs); Fill(5, owners);
        refSheet.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return File(ms.ToArray(), XlsxType, "LabelVihitha-Product-Upload-Template.xlsx");
    }

    [HttpPost("products")]
    [RequestSizeLimit(MaxBytes + 1024)]
    public async Task<ActionResult<ProductImportResult>> Products(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { status = 400, title = "No file was uploaded." });
        if (file.Length > MaxBytes)
            return BadRequest(new { status = 400, title = "File exceeds the 10 MB limit." });

        List<ProductImportRow> rows;
        try
        {
            await using var stream = file.OpenReadStream();
            rows = ParseRows(stream);
        }
        catch (Exception)
        {
            return BadRequest(new { status = 400, title = "Could not read the file. Use the provided .xlsx template." });
        }

        if (rows.Count == 0)
            return BadRequest(new { status = 400, title = "No data rows found. Fill the 'Products' sheet using the template." });

        var result = await _import.ImportAsync(rows, ct);
        return Ok(result);
    }

    // ---- Parse the "Products" sheet (or the first sheet) into rows ----
    private static List<ProductImportRow> ParseRows(Stream stream)
    {
        using var wb = new XLWorkbook(stream);
        var ws = wb.Worksheets.FirstOrDefault(s => s.Name.Equals("Products", StringComparison.OrdinalIgnoreCase))
                 ?? wb.Worksheets.First();

        // Map header names -> column number (row 1).
        var header = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var headerRow = ws.FirstRowUsed();
        if (headerRow is null) return new();
        foreach (var cell in headerRow.CellsUsed())
            header[cell.GetString().Trim()] = cell.Address.ColumnNumber;

        int Col(params string[] names)
        {
            foreach (var n in names)
                if (header.TryGetValue(n, out var c)) return c;
            return 0;
        }

        int cVendor = Col("Vendor"), cInv = Col("Inventory"), cCat = Col("Category"), cSub = Col("Subcategory"),
            cSku = Col("SKU"), cName = Col("Product Name", "Name"), cSize = Col("Size"), cQty = Col("Qty", "Quantity"),
            cCost = Col("Cost per unit (INR)", "Cost (INR)", "Cost"), cSale = Col("Sale price (USD)", "Sale (USD)", "Sale"),
            cReorder = Col("Reorder Threshold", "Reorder"), cColor = Col("Color"), cMaterial = Col("Material"),
            cDesc = Col("Description"), cPaidBy = Col("Paid By (owner)", "Paid By", "Paid By Owner"),
            cRate = Col("Rate per unit (INR)", "Rate (INR)", "Rate"), cGst = Col("GST %", "GST"),
            cDisc = Col("Discount %", "Discount"), cMarkup = Col("Markup %", "Markup"), cRound = Col("Round (INR)", "Round");

        var rows = new List<ProductImportRow>();
        foreach (var row in ws.RowsUsed().Skip(1)) // skip header
        {
            string? S(int c) => c == 0 ? null : row.Cell(c).GetString().Trim() is { Length: > 0 } v ? v : null;
            int I(int c) => c != 0 && double.TryParse(row.Cell(c).GetString(), out var d) ? (int)Math.Round(d) : 0;
            decimal? D(int c)
            {
                if (c == 0) return null;
                var raw = row.Cell(c).GetString().Replace("$", "").Replace("₹", "").Replace(",", "").Trim();
                return decimal.TryParse(raw, out var d) ? d : null;
            }

            var r = new ProductImportRow(
                row.RowNumber(), S(cVendor), S(cInv), S(cCat), S(cSub), S(cSku), S(cName), S(cSize),
                I(cQty), D(cCost), D(cSale), cReorder == 0 ? null : (int?)I(cReorder),
                S(cColor), S(cMaterial), S(cDesc), S(cPaidBy),
                D(cRate), D(cGst), D(cDisc), D(cMarkup), D(cRound));

            // Skip fully-empty rows.
            if (r.Sku is null && r.Name is null && r.Category is null) continue;
            rows.Add(r);
        }
        return rows;
    }
}
