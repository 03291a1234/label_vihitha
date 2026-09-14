namespace LabelVihitha.Application.Common.Exceptions;

/// <summary>Thrown on a business/uniqueness conflict (maps to HTTP 409).</summary>
public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
}
