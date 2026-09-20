using LabelVihitha.Application.Common.Interfaces;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace LabelVihitha.Infrastructure.Storage;

/// <summary>Stores uploads on local disk under the content root's wwwroot, served same-origin by
/// UseStaticFiles. Fine for dev; not durable across App Service restarts/scale — use AzureBlob there.</summary>
public class LocalFileStorage : IFileStorage
{
    private readonly string _root;
    public LocalFileStorage(IHostEnvironment env, IOptions<StorageOptions> options)
        => _root = Path.Combine(env.ContentRootPath, options.Value.LocalRoot);

    public async Task<StoredFile> SaveAsync(Stream content, string folder, string extension,
        string originalName, string contentType, CancellationToken ct = default)
    {
        var dir = Path.Combine(_root, folder.Replace('/', Path.DirectorySeparatorChar));
        Directory.CreateDirectory(dir);

        var fileName = $"{Guid.NewGuid():N}{extension}";
        var absolutePath = Path.Combine(dir, fileName);
        await using (var stream = File.Create(absolutePath))
            await content.CopyToAsync(stream, ct);

        return new StoredFile($"/{folder.TrimStart('/')}/{fileName}", Path.GetFileName(originalName));
    }
}
