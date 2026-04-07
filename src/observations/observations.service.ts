import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateObservationDto } from './dto/create-observation.dto';
import { UpdateObservationDto } from './dto/update-observation.dto';
import { ResolveObservationDto } from './dto/resolve-observation.dto';
import { QueryObservationsDto } from './dto/query-observations.dto';
import { ProcedureStatus, Prisma } from '@prisma/client';
import {
  OBSERVATION_MESSAGES,
  OBSERVATION_AUDIT_ACTIONS,
} from '../common/constants/observation.constants';

@Injectable()
export class ObservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private get observationInclude() {
    return {
      issuedBy: { select: { id: true, firstName: true, lastName: true } },
      resolvedBy: { select: { id: true, firstName: true, lastName: true } },
    };
  }

  // ---------------------------------------------------------------------------
  // create — POST /procedures/:procedureId/observations
  // ---------------------------------------------------------------------------

  async create(procedureId: string, dto: CreateObservationDto, userId: string) {
    const procedure = await this.prisma.procedure.findUnique({
      where: { id: procedureId },
    });
    if (!procedure || !procedure.isActive) {
      throw new NotFoundException(OBSERVATION_MESSAGES.ERROR.PROCEDURE_NOT_FOUND);
    }
    if (procedure.currentStatus !== ProcedureStatus.EN_REVISION) {
      throw new ConflictException(OBSERVATION_MESSAGES.ERROR.PROCEDURE_NOT_IN_REVISION);
    }

    // Resolve the cycle: use the provided cycleId or fall back to the active cycle.
    let resolvedCycleId = dto.cycleId;
    if (resolvedCycleId) {
      const cycle = await this.prisma.procedureCycle.findFirst({
        where: { id: resolvedCycleId, procedureId, isActive: true },
      });
      if (!cycle) {
        throw new NotFoundException(OBSERVATION_MESSAGES.ERROR.CYCLE_NOT_FOUND);
      }
      if (cycle.closedAt !== null) {
        throw new ConflictException(OBSERVATION_MESSAGES.ERROR.CYCLE_NOT_OPEN);
      }
    } else {
      const activeCycle = await this.prisma.procedureCycle.findFirst({
        where: { procedureId, closedAt: null, isActive: true },
        orderBy: { cycleNumber: 'desc' },
      });
      if (!activeCycle) {
        throw new NotFoundException(OBSERVATION_MESSAGES.ERROR.CYCLE_NOT_FOUND);
      }
      resolvedCycleId = activeCycle.id;
    }

    const observation = await this.prisma.observation.create({
      data: {
        procedureId,
        cycleId: resolvedCycleId,
        summary: dto.summary,
        details: dto.details ?? null,
        category: dto.category ?? null,
        priority: dto.priority ?? null,
        issuedByUserId: userId,
        isResolved: false,
      },
      include: this.observationInclude,
    });

    await this.auditService.log({
      action: OBSERVATION_AUDIT_ACTIONS.CREATED,
      userId,
      details: { observationId: observation.id, procedureId, cycleId: resolvedCycleId },
    });

    return observation;
  }

  // ---------------------------------------------------------------------------
  // findAll — GET /procedures/:procedureId/observations
  // ---------------------------------------------------------------------------

  async findAll(procedureId: string, query: QueryObservationsDto) {
    const procedure = await this.prisma.procedure.findUnique({ where: { id: procedureId } });
    if (!procedure || !procedure.isActive) {
      throw new NotFoundException(OBSERVATION_MESSAGES.ERROR.PROCEDURE_NOT_FOUND);
    }

    const { page = 1, limit = 10, cycleId, isResolved, category, priority } = query;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.ObservationWhereInput = { procedureId, isActive: true };
    if (cycleId !== undefined) where.cycleId = cycleId;
    if (isResolved !== undefined) where.isResolved = isResolved;
    if (category !== undefined) where.category = category;
    if (priority !== undefined) where.priority = priority;

    const [items, total] = await Promise.all([
      this.prisma.observation.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { issuedAt: 'desc' },
        include: this.observationInclude,
      }),
      this.prisma.observation.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    // groupedByCycle: all active observations grouped by cycle (unfiltered), ordered by cycle number
    const allObs = await this.prisma.observation.findMany({
      where: { procedureId, isActive: true },
      orderBy: { issuedAt: 'asc' },
      include: {
        ...this.observationInclude,
        cycle: { select: { id: true, cycleNumber: true } },
      },
    });

    const cycleMap = new Map<
      string,
      { cycleId: string | null; cycleNumber: number | null; observations: any[] }
    >();
    for (const obs of allObs) {
      const key = obs.cycleId ?? '__none__';
      if (!cycleMap.has(key)) {
        cycleMap.set(key, {
          cycleId: obs.cycleId,
          cycleNumber: (obs as any).cycle?.cycleNumber ?? null,
          observations: [],
        });
      }
      const { cycle: _cycle, ...obsWithoutCycle } = obs as any;
      cycleMap.get(key)!.observations.push(obsWithoutCycle);
    }
    const groupedByCycle = [...cycleMap.values()].sort(
      (a, b) => (a.cycleNumber ?? 0) - (b.cycleNumber ?? 0),
    );

    return {
      data: items,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPreviousPage: pageNum > 1,
      },
      groupedByCycle,
    };
  }

  // ---------------------------------------------------------------------------
  // findOne — GET /procedures/:procedureId/observations/:id
  // ---------------------------------------------------------------------------

  async findOne(procedureId: string, id: string) {
    const observation = await this.prisma.observation.findFirst({
      where: { id, procedureId, isActive: true },
      include: this.observationInclude,
    });
    if (!observation) {
      throw new NotFoundException(OBSERVATION_MESSAGES.ERROR.NOT_FOUND);
    }
    return observation;
  }

  // ---------------------------------------------------------------------------
  // findByCycle — GET /cycles/:cycleId/observations
  // ---------------------------------------------------------------------------

  async findByCycle(cycleId: string) {
    const cycle = await this.prisma.procedureCycle.findFirst({
      where: { id: cycleId, isActive: true },
    });
    if (!cycle) {
      throw new NotFoundException(OBSERVATION_MESSAGES.ERROR.CYCLE_NOT_FOUND);
    }

    return this.prisma.observation.findMany({
      where: { cycleId, isActive: true },
      orderBy: { issuedAt: 'asc' },
      include: this.observationInclude,
    });
  }

  // ---------------------------------------------------------------------------
  // update — PATCH /procedures/:procedureId/observations/:id
  // ---------------------------------------------------------------------------

  async update(procedureId: string, id: string, dto: UpdateObservationDto, userId: string) {
    const observation = await this.prisma.observation.findFirst({
      where: { id, procedureId, isActive: true },
    });
    if (!observation) {
      throw new NotFoundException(OBSERVATION_MESSAGES.ERROR.NOT_FOUND);
    }
    if (observation.isResolved) {
      throw new ConflictException(OBSERVATION_MESSAGES.ERROR.ALREADY_RESOLVED);
    }

    const data: Prisma.ObservationUpdateInput = {};
    if (dto.summary !== undefined) data.summary = dto.summary;
    if (dto.details !== undefined) data.details = dto.details;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.priority !== undefined) data.priority = dto.priority;

    const updated = await this.prisma.observation.update({
      where: { id },
      data,
      include: this.observationInclude,
    });

    await this.auditService.log({
      action: OBSERVATION_AUDIT_ACTIONS.UPDATED,
      userId,
      details: { observationId: id, procedureId, changes: dto },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // resolve — PATCH /procedures/:procedureId/observations/:id/resolve
  // ---------------------------------------------------------------------------

  async resolve(procedureId: string, id: string, dto: ResolveObservationDto, userId: string) {
    const observation = await this.prisma.observation.findFirst({
      where: { id, procedureId, isActive: true },
    });
    if (!observation) {
      throw new NotFoundException(OBSERVATION_MESSAGES.ERROR.NOT_FOUND);
    }
    if (observation.isResolved) {
      throw new ConflictException(OBSERVATION_MESSAGES.ERROR.ALREADY_RESOLVED);
    }

    const updated = await this.prisma.observation.update({
      where: { id },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
        resolvedByUserId: userId,
        resolutionNote: dto.resolutionNote ?? null,
      },
      include: this.observationInclude,
    });

    await this.auditService.log({
      action: OBSERVATION_AUDIT_ACTIONS.RESOLVED,
      userId,
      details: { observationId: id, procedureId },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // reopen — PATCH /procedures/:procedureId/observations/:id/reopen
  // ---------------------------------------------------------------------------

  async reopen(procedureId: string, id: string, userId: string) {
    const observation = await this.prisma.observation.findFirst({
      where: { id, procedureId, isActive: true },
    });
    if (!observation) {
      throw new NotFoundException(OBSERVATION_MESSAGES.ERROR.NOT_FOUND);
    }
    if (!observation.isResolved) {
      throw new ConflictException(OBSERVATION_MESSAGES.ERROR.NOT_RESOLVED);
    }

    const updated = await this.prisma.observation.update({
      where: { id },
      data: {
        isResolved: false,
        resolvedAt: null,
        resolvedByUserId: null,
        resolutionNote: null,
      },
      include: this.observationInclude,
    });

    await this.auditService.log({
      action: OBSERVATION_AUDIT_ACTIONS.REOPENED,
      userId,
      details: { observationId: id, procedureId },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // remove — DELETE /procedures/:procedureId/observations/:id (soft delete)
  // ---------------------------------------------------------------------------

  async remove(procedureId: string, id: string, userId: string) {
    const observation = await this.prisma.observation.findFirst({
      where: { id, procedureId, isActive: true },
    });
    if (!observation) {
      throw new NotFoundException(OBSERVATION_MESSAGES.ERROR.NOT_FOUND);
    }
    if (!observation.isResolved) {
      throw new ConflictException(OBSERVATION_MESSAGES.ERROR.DELETE_PENDING);
    }

    await this.prisma.observation.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await this.auditService.log({
      action: OBSERVATION_AUDIT_ACTIONS.DELETED,
      userId,
      details: { observationId: id, procedureId },
    });

    return { message: OBSERVATION_MESSAGES.SUCCESS.DELETED, id };
  }
}
