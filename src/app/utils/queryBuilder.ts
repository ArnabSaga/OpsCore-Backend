import {
  IQueryConfig,
  IQueryParams,
  IQueryResult,
  PrismaCountArgs,
  PrismaFindManyArgs,
  PrismaModelDelegate,
  PrismaNumberFilter,
  PrismaStringFilter,
  PrismaWhereCondition,
} from "../interfaces/query.interface";

//** T = Returned model type
export class QueryBuilder<
  T,
  TWhereInput = Record<string, unknown>,
  TInclude = Record<string, unknown>,
> {
  private query: PrismaFindManyArgs;
  private countQuery: PrismaCountArgs;

  private page = 1;
  private limit = 10;
  private skip = 0;

  private sortBy = "createdAt";
  private sortOrder: "asc" | "desc" = "desc";

  private selectFields: Record<string, boolean> | undefined;

  constructor(
    private model: PrismaModelDelegate,
    private queryParams: IQueryParams,
    private config: IQueryConfig = {}
  ) {
    //* Base find query
    this.query = {
      where: {},
      include: {},
      orderBy: {
        createdAt: "desc",
      },
      skip: 0,
      take: 10,
    };

    //* Base count query
    this.countQuery = {
      where: {},
    };
  }

  //* Search across configured fields
  search(): this {
    const { searchTerm } = this.queryParams;
    const { searchableFields } = this.config;

    if (!searchTerm || !searchableFields || searchableFields.length === 0) {
      return this;
    }

    const searchConditions = searchableFields
      .map((field) => this.buildSearchCondition(field, searchTerm))
      .filter(Boolean) as Record<string, unknown>[];

    if (searchConditions.length === 0) {
      return this;
    }

    this.appendLogicalArray(this.query.where as PrismaWhereCondition, "OR", searchConditions);
    this.appendLogicalArray(this.countQuery.where as PrismaWhereCondition, "OR", searchConditions);

    return this;
  }

  //* Apply filters from query params
  filter(): this {
    const { filterableFields } = this.config;

    const excludedFields = [
      "searchTerm",
      "page",
      "limit",
      "sortBy",
      "sortOrder",
      "fields",
      "include",
    ];

    const builtFilter: Record<string, unknown> = {};

    Object.keys(this.queryParams).forEach((key) => {
      if (excludedFields.includes(key)) return;

      const value = this.queryParams[key];

      if (value === undefined || value === "") return;

      const isAllowedField =
        !filterableFields || filterableFields.length === 0 || filterableFields.includes(key);

      if (!isAllowedField) return;

      const filterCondition = this.buildFilterCondition(key, value);

      if (filterCondition) {
        this.deepMergeInPlace(builtFilter, filterCondition);
      }
    });

    this.query.where = this.deepMerge(this.query.where as Record<string, unknown>, builtFilter);

    this.countQuery.where = this.deepMerge(
      this.countQuery.where as Record<string, unknown>,
      builtFilter
    );

    return this;
  }

  //* Apply pagination
  paginate(): this {
    const maxLimit = this.config.maxLimit ?? 100;

    const page = Math.max(Number(this.queryParams.page) || 1, 1);
    const limit = Math.max(Math.min(Number(this.queryParams.limit) || 10, maxLimit), 1);

    this.page = page;
    this.limit = limit;
    this.skip = (page - 1) * limit;

    this.query.skip = this.skip;
    this.query.take = this.limit;

    return this;
  }

  //* Apply sorting
  sort(): this {
    const requestedSortBy = this.queryParams.sortBy || "createdAt";
    const requestedSortOrder = this.queryParams.sortOrder === "asc" ? "asc" : "desc";

    const allowedSortFields = this.config.sortableFields ?? [];
    const isSortAllowed =
      allowedSortFields.length === 0 || allowedSortFields.includes(requestedSortBy);

    const safeSortBy = isSortAllowed ? requestedSortBy : "createdAt";

    this.sortBy = safeSortBy;
    this.sortOrder = requestedSortOrder;

    this.query.orderBy = this.buildSortCondition(safeSortBy, requestedSortOrder);

    return this;
  }

  //* Select only requested fields
  fields(): this {
    const fieldsParam = this.queryParams.fields;
    const selectableFields = this.config.selectableFields ?? [];

    if (!fieldsParam || typeof fieldsParam !== "string") {
      return this;
    }

    const fieldsArray = fieldsParam
      .split(",")
      .map((field) => field.trim())
      .filter(Boolean)
      .filter((field) => selectableFields.length === 0 || selectableFields.includes(field));

    if (fieldsArray.length === 0) {
      return this;
    }

    this.selectFields = {};

    fieldsArray.forEach((field) => {
      if (this.selectFields) {
        this.selectFields[field] = true;
      }
    });

    this.query.select = this.selectFields as Record<string, boolean | Record<string, unknown>>;

    //* select and include cannot be used together
    delete this.query.include;

    return this;
  }

  //* Add static include
  include(relation: TInclude): this {
    if (this.selectFields) {
      return this;
    }

    this.query.include = {
      ...(this.query.include as Record<string, unknown>),
      ...(relation as Record<string, unknown>),
    };

    return this;
  }

  //* Add dynamic include from query param
  dynamicInclude(includeConfig: Record<string, unknown>, defaultInclude: string[] = []): this {
    if (this.selectFields) {
      return this;
    }

    const result: Record<string, unknown> = {};

    defaultInclude.forEach((field) => {
      if (includeConfig[field]) {
        result[field] = includeConfig[field];
      }
    });

    const includeParam = this.queryParams.include;

    if (includeParam && typeof includeParam === "string") {
      const requestedRelations = includeParam
        .split(",")
        .map((relation) => relation.trim())
        .filter(Boolean);

      requestedRelations.forEach((relation) => {
        if (includeConfig[relation]) {
          result[relation] = includeConfig[relation];
        }
      });
    }

    this.query.include = {
      ...(this.query.include as Record<string, unknown>),
      ...result,
    };

    return this;
  }

  //* Add custom where condition
  where(condition: TWhereInput): this {
    this.query.where = this.deepMerge(
      this.query.where as Record<string, unknown>,
      condition as Record<string, unknown>
    );

    this.countQuery.where = this.deepMerge(
      this.countQuery.where as Record<string, unknown>,
      condition as Record<string, unknown>
    );

    return this;
  }

  //* Execute findMany + count
  async execute(): Promise<IQueryResult<T>> {
    const [total, data] = await Promise.all([
      this.model.count(this.countQuery as Parameters<typeof this.model.count>[0]),
      this.model.findMany(this.query as Parameters<typeof this.model.findMany>[0]),
    ]);

    const totalPages = Math.ceil(total / this.limit);

    return {
      data: data as T[],
      meta: {
        page: this.page,
        limit: this.limit,
        total,
        totalPages,
      },
    };
  }

  //* Execute only count
  async count(): Promise<number> {
    return await this.model.count(this.countQuery as Parameters<typeof this.model.count>[0]);
  }

  //* Return built query
  getQuery(): PrismaFindManyArgs {
    return this.query;
  }

  //* Build search condition from path
  private buildSearchCondition(field: string, searchTerm: string): Record<string, unknown> | null {
    const stringFilter: PrismaStringFilter = {
      contains: searchTerm,
      mode: "insensitive",
    };

    if (!field.includes(".")) {
      return {
        [field]: stringFilter,
      };
    }

    const parts = field.split(".");

    //* Example: user.name
    if (parts.length === 2) {
      const [relation, nestedField] = parts;

      return {
        [relation]: {
          [nestedField]: stringFilter,
        },
      };
    }

    //* Example: specialties.specialty.title
    if (parts.length === 3) {
      const [relation, nestedRelation, nestedField] = parts;

      return {
        [relation]: {
          some: {
            [nestedRelation]: {
              [nestedField]: stringFilter,
            },
          },
        },
      };
    }

    return null;
  }

  //* Build filter condition from key/value
  private buildFilterCondition(key: string, value: unknown): Record<string, unknown> | null {
    //* Direct field
    if (!key.includes(".")) {
      if (this.isRangeFilterObject(value)) {
        return {
          [key]: this.parseRangeFilter(value),
        };
      }

      return {
        [key]: this.parseFilterValue(value),
      };
    }

    const parts = key.split(".");

    //* Example: user.name
    if (parts.length === 2) {
      const [relation, nestedField] = parts;

      return {
        [relation]: {
          [nestedField]: this.isRangeFilterObject(value)
            ? this.parseRangeFilter(value)
            : this.parseFilterValue(value),
        },
      };
    }

    //* Example: specialties.specialty.title
    if (parts.length === 3) {
      const [relation, nestedRelation, nestedField] = parts;

      return {
        [relation]: {
          some: {
            [nestedRelation]: {
              [nestedField]: this.isRangeFilterObject(value)
                ? this.parseRangeFilter(value)
                : this.parseFilterValue(value),
            },
          },
        },
      };
    }

    return null;
  }

  //* Build sort condition from path
  private buildSortCondition(sortBy: string, sortOrder: "asc" | "desc"): Record<string, unknown> {
    if (!sortBy.includes(".")) {
      return {
        [sortBy]: sortOrder,
      };
    }

    const parts = sortBy.split(".");

    //* Example: user.name
    if (parts.length === 2) {
      const [relation, nestedField] = parts;

      return {
        [relation]: {
          [nestedField]: sortOrder,
        },
      };
    }

    //* Fallback to direct sort if deep sort becomes invalid
    return {
      createdAt: sortOrder,
    };
  }

  //* Merge logical arrays like OR/AND
  private appendLogicalArray(
    target: PrismaWhereCondition,
    key: "OR" | "AND",
    conditions: Record<string, unknown>[]
  ): void {
    const existing: Record<string, unknown>[] = Array.isArray(target[key])
      ? [...(target[key] as Record<string, unknown>[])]
      : [];

    target[key] = [...existing, ...conditions];
  }

  //* Check if value is range filter object
  private isRangeFilterObject(
    value: unknown
  ): value is Record<string, string | number | string[] | number[]> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  //* Merge source into target directly
  private deepMergeInPlace(target: Record<string, unknown>, source: Record<string, unknown>): void {
    const merged = this.deepMerge(target, source);

    Object.keys(target).forEach((key) => delete target[key]);
    Object.assign(target, merged);
  }

  //* Deep merge two objects
  private deepMerge(
    target: Record<string, unknown>,
    source: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...target };

    for (const key in source) {
      const targetValue = result[key];
      const sourceValue = source[key];

      //* Merge arrays for OR/AND/NOT if needed
      if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
        result[key] = [...targetValue, ...sourceValue];
        continue;
      }

      //* Merge nested objects
      if (
        targetValue &&
        sourceValue &&
        typeof targetValue === "object" &&
        typeof sourceValue === "object" &&
        !Array.isArray(targetValue) &&
        !Array.isArray(sourceValue)
      ) {
        result[key] = this.deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        );
        continue;
      }

      //* Override value
      result[key] = sourceValue;
    }

    return result;
  }

  //* Parse plain value
  private parseFilterValue(value: unknown): unknown {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    if (typeof value === "string" && value !== "" && !isNaN(Number(value))) {
      return Number(value);
    }

    if (Array.isArray(value)) {
      return {
        in: value.map((item) => this.parseFilterValue(item)),
      };
    }

    return value;
  }

  //* Parse range operators
  private parseRangeFilter(
    value: Record<string, string | number | string[] | number[]>
  ): PrismaNumberFilter | PrismaStringFilter | Record<string, unknown> {
    const rangeQuery: Record<string, unknown> = {};

    Object.keys(value).forEach((operator) => {
      const operatorValue = value[operator];

      const parsedValue = Array.isArray(operatorValue)
        ? operatorValue.map((item) =>
            typeof item === "string" && item !== "" && !isNaN(Number(item)) ? Number(item) : item
          )
        : typeof operatorValue === "string" && operatorValue !== "" && !isNaN(Number(operatorValue))
          ? Number(operatorValue)
          : operatorValue;

      switch (operator) {
        case "lt":
        case "lte":
        case "gt":
        case "gte":
        case "equals":
        case "not":
          rangeQuery[operator] = parsedValue;
          break;

        case "contains":
        case "startsWith":
        case "endsWith":
          rangeQuery[operator] = parsedValue;
          rangeQuery.mode = "insensitive";
          break;

        case "in":
        case "notIn":
          rangeQuery[operator] = Array.isArray(parsedValue) ? parsedValue : [parsedValue];
          break;

        default:
          break;
      }
    });

    return Object.keys(rangeQuery).length > 0 ? rangeQuery : value;
  }
}
