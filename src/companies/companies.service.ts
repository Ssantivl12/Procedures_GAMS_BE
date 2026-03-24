import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { QueryCompaniesDto } from './dto/query-companies.dto';
import { Company, Prisma } from '@prisma/client';
import { COMPANY_MESSAGES, COMPANY_DEFAULTS, COMPANY_AUDIT_ACTIONS } from '../common/constants/company.constants';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCompanyDto, userId: string): Promise<Company> {
    if (!dto.category) {
      throw new BadRequestException(COMPANY_MESSAGES.ERROR.CATEGORY_REQUIRED);
    }

    if (dto.nit) {
      const existing = await this.prisma.company.findFirst({
        where: { nit: dto.nit },
      });
      if (existing) {
        throw new ConflictException(COMPANY_MESSAGES.ERROR.NIT_EXISTS);
      }
    }

    const data: Prisma.CompanyCreateInput = {
      legalName: dto.legalName,
      category: dto.category,
      nit: dto.nit,
      address: dto.address,
      phone: dto.phone,
      email: dto.email,
      legalRepName: dto.legalRepName,
      legalRepCi: dto.legalRepCi,
      caebCodes: dto.caebCodes || [],
      economicActivity: dto.economicActivity,
      municipality: dto.municipality || COMPANY_DEFAULTS.MUNICIPALITY,
      observations: dto.observations,

      businessClass: dto.businessClass,
      district: dto.district,
      geoZone: dto.geoZone,
      utmZone: dto.utmZone,
      coordinates: dto.coordinates,
      effluentDisposal: dto.effluentDisposal,
      solidWasteDisposal: dto.solidWasteDisposal,
      useHazardousSubstances: dto.useHazardousSubstances ?? false,
      hazardousSubstancesDescription: dto.useHazardousSubstances
        ? dto.hazardousSubstancesDescription
        : null,
      usesMercury: dto.usesMercury ?? false,

      rawMaterials: (dto.rawMaterials ?? []) as unknown as Prisma.InputJsonValue,
      finalProducts: (dto.finalProducts ?? []) as unknown as Prisma.InputJsonValue,
      
      usedArea: dto.usedArea,
      areaUnit: dto.areaUnit,
      waterSupply: dto.waterSupply,
      installedPower: dto.installedPower,
    };

    const company = await this.prisma.company.create({ data });

    await this.auditService.log({
      action: COMPANY_AUDIT_ACTIONS.CREATED,
      userId,
      details: { companyId: company.id, legalName: company.legalName },
    });

    return company;
  }

  async findAll(query: QueryCompaniesDto) {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      municipality,
      hasRaiNumber,
      isActive = true,
      sortBy = 'legalName' as const,
      sortOrder = 'asc' as const,
    } = query;

    const pageNum = Number(page);
    const limitNum = Number(limit);

    const where: Prisma.CompanyWhereInput = {
      isActive,
    };

    if (search) {
      where.OR = [
        { legalName: { contains: search, mode: 'insensitive' } },
        { nit: { contains: search } },
        { raiNumber: { contains: search } },
      ];
    }

    if (category) where.category = category;
    if (municipality) where.municipality = municipality;
    if (hasRaiNumber !== undefined) {
      where.raiNumber = hasRaiNumber ? { not: null } : null;
    }

    const orderBy: Prisma.CompanyOrderByWithRelationInput[] = [
      { isActive: 'desc' },
      { [sortBy]: sortOrder },
    ];

    const skip = (pageNum - 1) * limitNum;
    const take = limitNum;

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          caseFile: { select: { id: true } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return {
      data: data.map(({ caseFile, ...company }) => ({
        ...company,
        _count: { caseFile: caseFile ? 1 : 0 },
      })),
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
    };
  }

  async findOne(id: string, includeCaseFile = false): Promise<Company | null> {
    return this.prisma.company.findUnique({
      where: { id },
      include: {
        caseFile: includeCaseFile,
      },
    });
  }

  async update(id: string, dto: UpdateCompanyDto, userId: string): Promise<Company> {
    const current = await this.prisma.company.findUnique({ where: { id } });

    if (dto.nit) {
      const existing = await this.prisma.company.findFirst({
        where: { nit: dto.nit, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(COMPANY_MESSAGES.ERROR.NIT_EXISTS);
      }
    }

    if (dto.raiNumber) {
      const existing = await this.prisma.company.findFirst({
        where: {
          raiNumber: dto.raiNumber,
          id: { not: id },
        },
      });
      if (existing) {
        throw new ConflictException(COMPANY_MESSAGES.ERROR.RAI_EXISTS);
      }
    }

    const data: Prisma.CompanyUpdateInput = {};
    if (dto.legalName !== undefined) data.legalName = dto.legalName;
    if (dto.nit !== undefined) data.nit = dto.nit;
    if (dto.raiNumber !== undefined) data.raiNumber = dto.raiNumber;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.legalRepName !== undefined) data.legalRepName = dto.legalRepName;
    if (dto.legalRepCi !== undefined) data.legalRepCi = dto.legalRepCi;
    if (dto.caebCodes !== undefined) data.caebCodes = dto.caebCodes;
    if (dto.economicActivity !== undefined) data.economicActivity = dto.economicActivity;
    if (dto.municipality !== undefined) data.municipality = dto.municipality;
    if (dto.observations !== undefined) data.observations = dto.observations;
    if (dto.businessClass  !== undefined) data.businessClass  = dto.businessClass;
    if (dto.district       !== undefined) data.district       = dto.district;
    if (dto.geoZone        !== undefined) data.geoZone        = dto.geoZone;
    if (dto.utmZone        !== undefined) data.utmZone        = dto.utmZone;
    if (dto.coordinates    !== undefined) data.coordinates    = dto.coordinates;
    if (dto.effluentDisposal   !== undefined) data.effluentDisposal   = dto.effluentDisposal;
    if (dto.solidWasteDisposal !== undefined) data.solidWasteDisposal = dto.solidWasteDisposal;
    if (dto.useHazardousSubstances !== undefined) {
      data.useHazardousSubstances = dto.useHazardousSubstances;

      data.hazardousSubstancesDescription = dto.useHazardousSubstances
        ? dto.hazardousSubstancesDescription
        : null;
    }
    if (dto.usesMercury    !== undefined) data.usesMercury    = dto.usesMercury;
    if (dto.rawMaterials   !== undefined) data.rawMaterials   = dto.rawMaterials   as any;
    if (dto.finalProducts  !== undefined) data.finalProducts  = dto.finalProducts  as any;
    if (dto.usedArea       !== undefined) data.usedArea       = dto.usedArea;
    if (dto.areaUnit       !== undefined) data.areaUnit       = dto.areaUnit;
    if (dto.waterSupply    !== undefined) data.waterSupply    = dto.waterSupply;
    if (dto.installedPower !== undefined) data.installedPower = dto.installedPower;

    const company = await this.prisma.company.update({
      where: { id },
      data,
    });

    const changedFields = Object.keys(data).reduce<
      Record<string, { before: unknown; after: unknown }>
    >((acc, key) => {
      acc[key] = {
        before: current ? current[key as keyof Company] : undefined,
        after: (data as Record<string, unknown>)[key],
      };
      return acc;
    }, {});

    await this.auditService.log({
      action: COMPANY_AUDIT_ACTIONS.UPDATED,
      userId,
      details: { companyId: id, changes: changedFields },
    });

    return company;
  }

  async remove(id: string, userId: string): Promise<{ message: string; id: string }> {
    await this.prisma.company.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    await this.auditService.log({
      action: COMPANY_AUDIT_ACTIONS.DELETED,
      userId,
      details: { companyId: id },
    });

    return {
      message: COMPANY_MESSAGES.SUCCESS.DELETED,
      id,
    };
  }

  async hasActiveCaseFile(companyId: string): Promise<boolean> {
    const caseFile = await this.prisma.caseFile.findFirst({
      where: {
        companyId,
        isActive: true,
        closedAt: null,
      },
    });
    return !!caseFile;
  }

  async getCaseFile(companyId: string) {
    return this.prisma.caseFile.findUnique({
      where: { companyId },
      include: {
        company: {
          select: {
            id: true,
            legalName: true,
            raiNumber: true,
            category: true,
          },
        },
      },
    });
  }
}