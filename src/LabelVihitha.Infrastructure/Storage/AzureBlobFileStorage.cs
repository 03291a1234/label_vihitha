using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using LabelVihitha.Application.Common.Interfaces;
using Microsoft.Extensions.Options;

namespace LabelVihitha.Infrastructure.Storage;

/// <summary>Stores uploads in Azure Blob Storage — durable across restarts and scale-out. Selected
/// when Storage:Provider = AzureBlob. Blobs are public-read so the SPA can link them directly.</summary>
public class AzureBlobFileStorage : IFileStorage
{
    private readonly BlobContainerClient _container;

    public AzureBlobFileStorage(IOptions<StorageOptions> options)
    {
        var o = options.Value;
        if (string.IsNullOrWhiteSpace(o.BlobConnectionString))
            throw new InvalidOperationException("Storage:BlobConnectionString is required when Provider = AzureBlob.");
        _container = new BlobContainerClient(o.BlobConnectionString, o.Container);
    }

    public async Task<StoredFile> SaveAsync(Stream content, string folder, string extension,
        string originalName, string contentType, CancellationToken ct = default)
    {
        await _container.CreateIfNotExistsAsync(PublicAccessType.Blob, cancellationToken: ct);

        var blobName = $"{folder.Trim('/')}/{Guid.NewGuid():N}{extension}";
        var blob = _container.GetBlobClient(blobName);
        await blob.UploadAsync(content, new BlobUploadOptions
        {
            HttpHeaders = new BlobHttpHeaders { ContentType = contentType }
        }, ct);

        // Absolute https URL — the SPA links it directly (its fileUrl() leaves http(s) URLs as-is).
        return new StoredFile(blob.Uri.ToString(), Path.GetFileName(originalName));
    }
}
