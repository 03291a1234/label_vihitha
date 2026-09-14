using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,Inventory")]
[Route("api/uploads")]
public class UploadsController : ControllerBase
{
    private const long MaxBytes = 5 * 1024 * 1024; // 5 MB

    // Allowlist of image content types → canonical extension.
    private static readonly Dictionary<string, string> Allowed = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
        ["image/gif"] = ".gif"
    };

    private readonly IWebHostEnvironment _env;

    public UploadsController(IWebHostEnvironment env) => _env = env;

    public record UploadResult(string Url);

    [HttpPost("product-image")]
    [RequestSizeLimit(MaxBytes + 1024)]
    public async Task<ActionResult<UploadResult>> ProductImage(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { status = 400, title = "No file was uploaded." });
        if (file.Length > MaxBytes)
            return BadRequest(new { status = 400, title = "File exceeds the 5 MB limit." });
        if (!Allowed.TryGetValue(file.ContentType, out var ext))
            return BadRequest(new { status = 400, title = "Only JPEG, PNG, WebP or GIF images are allowed." });

        // Never trust the client filename — generate a random one.
        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var relativeDir = Path.Combine("uploads", "products");
        var absoluteDir = Path.Combine(webRoot, relativeDir);
        Directory.CreateDirectory(absoluteDir);

        var fileName = $"{Guid.NewGuid():N}{ext}";
        var absolutePath = Path.Combine(absoluteDir, fileName);

        await using (var stream = System.IO.File.Create(absolutePath))
            await file.CopyToAsync(stream, ct);

        // Root-relative URL served by UseStaticFiles; the web client resolves it against the API origin.
        var url = $"/uploads/products/{fileName}";
        return Ok(new UploadResult(url));
    }
}
