using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Features.Auth;
using LabelVihitha.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace LabelVihitha.Infrastructure.Auth;

public class IdentityService : IIdentityService
{
    private readonly UserManager<ApplicationUser> _users;
    private readonly ITokenService _tokens;

    public IdentityService(UserManager<ApplicationUser> users, ITokenService tokens)
    {
        _users = users;
        _tokens = tokens;
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken ct = default)
    {
        var user = await _users.FindByNameAsync(request.UserName);
        if (user is null || !await _users.CheckPasswordAsync(user, request.Password))
            throw new UnauthorizedException("Invalid username or password.");

        var roles = await _users.GetRolesAsync(user);
        var (token, expires) = _tokens.CreateToken(user, roles);
        return new AuthResponse(token, expires, user.UserName!, roles.ToList());
    }
}
