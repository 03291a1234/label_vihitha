namespace LabelVihitha.Infrastructure.Storage;

/// <summary>Bound from the "Storage" config section. Local by default; set Provider to "AzureBlob"
/// and supply a connection string to use durable cloud storage in the cloud.</summary>
public class StorageOptions
{
    public const string SectionName = "Storage";

    /// <summary>"Local" (wwwroot) or "AzureBlob".</summary>
    public string Provider { get; set; } = "Local";

    /// <summary>Azure Storage connection string (required when Provider = AzureBlob).</summary>
    public string? BlobConnectionString { get; set; }

    /// <summary>Blob container name.</summary>
    public string Container { get; set; } = "uploads";

    /// <summary>Local disk root, relative to the content root (served by UseStaticFiles).</summary>
    public string LocalRoot { get; set; } = "wwwroot";
}
