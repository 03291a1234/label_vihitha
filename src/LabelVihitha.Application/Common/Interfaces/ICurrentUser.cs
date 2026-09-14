namespace LabelVihitha.Application.Common.Interfaces;

/// <summary>Ambient info about the authenticated caller (set from the JWT in the API layer).</summary>
public interface ICurrentUser
{
    string? UserId { get; }
    string? UserName { get; }
}
