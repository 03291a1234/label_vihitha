namespace LabelVihitha.Application.Features.Auth;

public record LoginRequest(string UserName, string Password);

public record AuthResponse(
    string AccessToken,
    DateTime ExpiresAtUtc,
    string UserName,
    IReadOnlyList<string> Roles);

/// <summary>Auth operations backed by ASP.NET Identity (implemented in Infrastructure).</summary>
public interface IIdentityService
{
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default);
}
