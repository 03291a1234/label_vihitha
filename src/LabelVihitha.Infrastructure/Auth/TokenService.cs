using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using LabelVihitha.Infrastructure.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace LabelVihitha.Infrastructure.Auth;

public interface ITokenService
{
    (string token, DateTime expiresAtUtc) CreateToken(ApplicationUser user, IEnumerable<string> roles);
}

public class TokenService : ITokenService
{
    private readonly JwtSettings _settings;

    public TokenService(IOptions<JwtSettings> settings) => _settings = settings.Value;

    public (string token, DateTime expiresAtUtc) CreateToken(ApplicationUser user, IEnumerable<string> roles)
    {
        var expires = DateTime.UtcNow.AddMinutes(_settings.ExpiryMinutes);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.UserName ?? string.Empty)
        };
        claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

        var creds = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.Key)),
            SecurityAlgorithms.HmacSha256);

        var jwt = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: expires,
            signingCredentials: creds);

        return (new JwtSecurityTokenHandler().WriteToken(jwt), expires);
    }
}
