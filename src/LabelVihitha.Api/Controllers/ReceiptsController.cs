using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Receipt file uploads for expenses (images or PDF). Admin/Owner only.</summary>
[ApiController]
[Authorize(Roles = "Admin,Owner")]
[Route("api/uploads")]
public class ReceiptsController : ControllerBase
{
    private const long MaxBytes = 10 * 1024 * 1024; // 10 MB

    private static readonly Dictionary<string, string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
        ["image/gif"] = ".gif",
        ["application/pdf"] = ".pdf"
    };

    private readonly IWebHostEnvironment _env;
    public ReceiptsController(IWebHostEnvironment env) => _env = env;

    public record UploadResult(string Url);

    [HttpPost("receipt")]
    [RequestSizeLimit(MaxBytes + 1024)]
    public async Task<ActionResult<UploadResult>> Receipt(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { status = 400, title = "No file was uploaded." });
        if (file.Length > MaxBytes)
            return BadRequest(new { status = 400, title = "File exceeds the 10 MB limit." });
        if (!Allowed.TryGetValue(file.ContentType, out var ext))
            return BadRequest(new { status = 400, title = "Only JPEG, PNG, WebP, GIF or PDF files are allowed." });

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var absoluteDir = Path.Combine(webRoot, "uploads", "receipts");
        Directory.CreateDirectory(absoluteDir);

        var fileName = $"{Guid.NewGuid():N}{ext}";
        var absolutePath = Path.Combine(absoluteDir, fileName);
        await using (var stream = System.IO.File.Create(absolutePath))
            await file.CopyToAsync(stream, ct);

        return Ok(new UploadResult($"/uploads/receipts/{fileName}"));
    }
}
