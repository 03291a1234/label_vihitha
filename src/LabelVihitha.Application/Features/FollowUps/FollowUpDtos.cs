using LabelVihitha.Domain.Enums;

namespace LabelVihitha.Application.Features.FollowUps;

public record FollowUpDto(
    int Id,
    int OrderId,
    string OrderNumber,
    int? OrderItemId,
    string? ProductName,
    string Note,
    DateTime? FollowUpDate,
    FollowUpStatus Status,
    string? CreatedBy,
    DateTime CreatedAt,
    DateTime? ResolvedAt,
    string? ResolutionNote,
    bool IsOverdue);

public record CreateFollowUpRequest(
    string Note,
    int? OrderItemId,
    DateTime? FollowUpDate);

public record UpdateFollowUpRequest(
    FollowUpStatus Status,
    string? Note,
    DateTime? FollowUpDate,
    string? ResolutionNote);

public record FollowUpQuery(
    FollowUpStatus? Status = null,
    bool OverdueOnly = false,
    bool OpenOnly = true,
    string? CreatedBy = null,
    int Page = 1,
    int PageSize = 50);
