using LabelVihitha.Application.Common.Exceptions;
using LabelVihitha.Application.Common.Interfaces;
using LabelVihitha.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace LabelVihitha.Application.Features.Customers;

public class CustomerService : ICustomerService
{
    private readonly IApplicationDbContext _db;

    public CustomerService(IApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<CustomerDto>> GetAllAsync(string? search, CancellationToken ct = default)
    {
        var q = _db.Customers.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            q = q.Where(c => c.Name.Contains(term)
                || (c.Phone != null && c.Phone.Contains(term))
                || (c.Email != null && c.Email.Contains(term)));
        }

        return await q
            .OrderBy(c => c.Name)
            .Select(c => new CustomerDto(
                c.Id, c.Name, c.Phone, c.Email, c.Address, c.Notes,
                c.Orders.Count(o => !o.IsDeleted)))
            .ToListAsync(ct);
    }

    public async Task<CustomerDto> GetByIdAsync(int id, CancellationToken ct = default)
    {
        var dto = await _db.Customers.AsNoTracking()
            .Where(c => c.Id == id)
            .Select(c => new CustomerDto(
                c.Id, c.Name, c.Phone, c.Email, c.Address, c.Notes,
                c.Orders.Count(o => !o.IsDeleted)))
            .FirstOrDefaultAsync(ct);
        return dto ?? throw new NotFoundException(nameof(Customer), id);
    }

    public async Task<CustomerDto> CreateAsync(CreateCustomerRequest request, CancellationToken ct = default)
    {
        var entity = new Customer
        {
            Name = request.Name.Trim(),
            Phone = request.Phone,
            Email = request.Email,
            Address = request.Address,
            Notes = request.Notes
        };
        _db.Customers.Add(entity);
        await _db.SaveChangesAsync(ct);
        return new CustomerDto(entity.Id, entity.Name, entity.Phone, entity.Email, entity.Address, entity.Notes, 0);
    }

    public async Task<CustomerDto> UpdateAsync(int id, UpdateCustomerRequest request, CancellationToken ct = default)
    {
        var entity = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException(nameof(Customer), id);

        entity.Name = request.Name.Trim();
        entity.Phone = request.Phone;
        entity.Email = request.Email;
        entity.Address = request.Address;
        entity.Notes = request.Notes;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        var orderCount = await _db.Orders.CountAsync(o => o.CustomerId == id && !o.IsDeleted, ct);
        return new CustomerDto(entity.Id, entity.Name, entity.Phone, entity.Email, entity.Address, entity.Notes, orderCount);
    }

    public async Task DeleteAsync(int id, CancellationToken ct = default)
    {
        var entity = await _db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw new NotFoundException(nameof(Customer), id);

        if (await _db.Orders.AnyAsync(o => o.CustomerId == id && !o.IsDeleted, ct))
            throw new ConflictException("Cannot delete a customer who has orders. Deactivate instead.");

        entity.IsDeleted = true;
        entity.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }
}
