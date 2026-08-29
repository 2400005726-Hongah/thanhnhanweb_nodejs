import { readFile } from 'node:fs/promises'

const files = Object.fromEntries(
  await Promise.all(
    [
      ['publicRoute', new URL('../src/routes/public.routes.js', import.meta.url)],
      ['publicValidator', new URL('../src/validators/publicTrip.validator.js', import.meta.url)],
      ['publicService', new URL('../src/services/publicTrip.service.js', import.meta.url)],
      ['publicFrontendService', new URL('../../frontend/src/services/publicTrip.service.js', import.meta.url)],
      ['searchForm', new URL('../../frontend/src/components/search/TripSearchForm.jsx', import.meta.url)],
      ['searchPage', new URL('../../frontend/src/pages/SearchTripsPage.jsx', import.meta.url)],
    ].map(async ([name, url]) => [name, await readFile(url, 'utf8')]),
  ),
)

describe('Giai đoạn 6B MVC parity - Tìm chuyến theo tỉnh/thành và bộ lọc', () => {
  test('form chính dùng Tỉnh/Thành đi, Tỉnh/Thành đến và ngày khởi hành', () => {
    expect(files.searchForm).toContain('Tỉnh/Thành đi')
    expect(files.searchForm).toContain('Tỉnh/Thành đến')
    expect(files.searchForm).toContain('Ngày khởi hành')
    expect(files.searchForm).toContain('departureProvinceId')
    expect(files.searchForm).toContain('arrivalProvinceId')
  })

  test('có catalog public cho tỉnh/thành và bộ lọc khu vực', () => {
    expect(files.publicRoute).toContain("'/search/catalog'")
    expect(files.publicFrontendService).toContain('getTripSearchCatalog')
    expect(files.publicService).toContain('getPublicTripSearchCatalog')
    expect(files.publicService).toContain("areas:")
  })

  test('trang kết quả có bộ lọc khu vực điểm đi và điểm đến chọn nhiều', () => {
    expect(files.searchPage).toContain('Khu vực điểm đi')
    expect(files.searchPage).toContain('Khu vực điểm đến')
    expect(files.searchPage).toContain('departureAreaIds')
    expect(files.searchPage).toContain('arrivalAreaIds')
    expect(files.searchPage).toContain('type="checkbox"')
  })

  test('backend khớp địa điểm cụ thể qua đúng một bộ lọc defaultAreaId', () => {
    expect(files.publicService).toContain('defaultAreaId')
    expect(files.publicService).not.toContain('areaFilters')
    expect(files.publicService).toContain('buildAreaLocationWhere')
    expect(files.publicService).toContain('departureLocation')
    expect(files.publicService).toContain('arrivalLocation')
  })

  test('giữ các bộ lọc giá, giờ và loại xe của MVC/Node hiện tại', () => {
    for (const value of [
      'minPrice',
      'maxPrice',
      'departureTimeFrom',
      'departureTimeTo',
      'busType',
      'sort',
    ]) {
      expect(files.searchPage).toContain(value)
      expect(files.publicValidator).toContain(value)
    }
  })

  test('API vẫn tương thích tìm chuyến exact location cũ để không phá chức năng đang có', () => {
    expect(files.publicValidator).toContain('departureLocationId')
    expect(files.publicValidator).toContain('arrivalLocationId')
    expect(files.publicService).toContain('ensureActiveLocations')
    expect(files.publicService).toContain('usesProvinceSearch')
  })
})
