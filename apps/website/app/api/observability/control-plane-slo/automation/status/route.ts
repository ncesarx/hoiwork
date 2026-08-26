import { NextResponse } from "next/server";
import { requireOrganization } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
export const dynamic="force-dynamic";
export async function GET(){const {organization}=await requireOrganization();const [config,lastRuns]=await Promise.all([prisma.controlPlaneSloPolicy.findUnique({where:{organizationId:organization.id}}),prisma.controlPlaneSloAutomationRun.findMany({where:{organizationId:organization.id},orderBy:{startedAt:"desc"},take:10})]);return NextResponse.json({ok:true,version:"015.6.11.7.3.3",config,lastRuns});}
