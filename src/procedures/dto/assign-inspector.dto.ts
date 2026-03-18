import { IsUUID } from 'class-validator';

export class AssignInspectorDto {
  @IsUUID()
  inspectorUserId: string;
}
