using System.Security.Claims;
using LabelVihitha.Application.Common.Interfaces;

namespace LabelVihitha.Api.Infrastructure;

public class CurrentUser : ICurrentUser
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentUser(IHttpContextAccessor accessor) => _accessor = accessor;

    private ClaimsPrincipal? Principal => _accessor.HttpContext?.User;

    public string? UserId => Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
    public string? UserName => Principal?.FindFirstValue(ClaimTypes.Name);
}
