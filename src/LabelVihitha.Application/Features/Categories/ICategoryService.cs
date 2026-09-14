namespace LabelVihitha.Application.Features.Categories;

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> GetAllAsync(bool includeInactive, CancellationToken ct = default);
    Task<CategoryDto> GetByIdAsync(int id, CancellationToken ct = default);
    Task<CategoryDto> CreateAsync(CreateCategoryRequest request, CancellationToken ct = default);
    Task<CategoryDto> UpdateAsync(int id, UpdateCategoryRequest request, CancellationToken ct = default);
    Task DeleteAsync(int id, CancellationToken ct = default);
}
