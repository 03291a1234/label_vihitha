namespace LabelVihitha.Application.Common.Interfaces;

/// <summary>A stored upload: the URL to reference it by and the original display filename.</summary>
public record StoredFile(string Url, string FileName);

/// <summary>Abstraction over where uploaded files live (local disk in dev, durable blob storage in
/// the cloud) so controllers don't care and files survive restarts/scale-out.</summary>
public interface IFileStorage
{
    /// <param name="folder">Logical folder, e.g. "uploads/bills".</param>
    /// <param name="extension">File extension including the dot, e.g. ".pdf".</param>
    Task<StoredFile> SaveAsync(Stream content, string folder, string extension,
        string originalName, string contentType, CancellationToken ct = default);
}
