using LabelVihitha.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace LabelVihitha.Api.Controllers;

/// <summary>Supplier-bill file uploads (image or PDF) for inventory batches. Admin/Inventory/Owner.</summary>
[ApiController]
[Authorize(Roles = "Admin,Inventory,Owner")]
[Route("api/uploads")]
public class BillUploadsController : ControllerBase
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

    private readonly IFileStorage _storage;
    public BillUploadsController(IFileStorage storage) => _storage = storage;

    public record UploadResult(string Url, string FileName);

    [HttpPost("bill")]
    [RequestSizeLimit(MaxBytes + 1024)]
    public async Task<ActionResult<UploadResult>> Bill(IFormFile? file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { status = 400, title = "No file was uploaded." });
        if (file.Length > MaxBytes)
            return BadRequest(new { status = 400, title = "File exceeds the 10 MB limit." });
        if (!Allowed.TryGetValue(file.ContentType, out var ext))
            return BadRequest(new { status = 400, title = "Only JPEG, PNG, WebP, GIF or PDF files are allowed." });

        await using var stream = file.OpenReadStream();
        var stored = await _storage.SaveAsync(stream, "uploads/bills", ext, file.FileName, file.ContentType, ct);
        return Ok(new UploadResult(stored.Url, stored.FileName));
    }
}
