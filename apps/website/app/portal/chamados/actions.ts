"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOrganization } from "@/lib/authz";

const schema = z.object({
  title: z.string().trim().min(5).max(140),
  description: z.string().trim().min(10).max(5000),
  priority: z.enum(["LOW","MEDIUM","HIGH","CRITICAL"]),
});

export type TicketState = { success: boolean; message: string };

export async function createTicket(_state: TicketState, formData: FormData): Promise<TicketState> {
  const parsed = schema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority"),
  });
  if (!parsed.success) return { success:false, message:"Revise os campos do chamado." };

  const { session, organization } = await requireOrganization();
  const ticket = await prisma.ticket.create({
    data: {
      organizationId: organization.id,
      openedById: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      status: "OPEN",
    },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      userId: session.user.id,
      action: "TICKET_CREATED",
      entity: "Ticket",
      entityId: ticket.id,
      metadata: { priority: ticket.priority },
    },
  });

  revalidatePath("/portal");
  revalidatePath("/portal/chamados");
  return { success:true, message:"Chamado criado com sucesso." };
}
