namespace LabelVihitha.Infrastructure.Auth;

public class JwtSettings
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = "LabelVihitha";
    public string Audience { get; set; } = "LabelVihitha";
    public string Key { get; set; } = string.Empty;
    public int ExpiryMinutes { get; set; } = 480; // 8h working day
}
