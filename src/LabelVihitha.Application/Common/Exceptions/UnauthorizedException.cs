namespace LabelVihitha.Application.Common.Exceptions;

/// <summary>Thrown on failed authentication (maps to HTTP 401).</summary>
public class UnauthorizedException : Exception
{
    public UnauthorizedException(string message) : base(message) { }
}
