namespace LabelVihitha.Application.Common.Exceptions;

/// <summary>Thrown when an entity is requested by id but does not exist (maps to HTTP 404).</summary>
public class NotFoundException : Exception
{
    public NotFoundException(string name, object key)
        : base($"\"{name}\" ({key}) was not found.") { }

    public NotFoundException(string message) : base(message) { }
}
