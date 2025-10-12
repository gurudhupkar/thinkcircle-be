import { PrismaClient } from "@prisma/client";
import { equal } from "assert";
import { maxSize } from "zod";

const prisma = new PrismaClient();

export async function suggestgroups(userId: string, subjectFocus?: string) {
  return await prisma.$transaction(async (tx) => {
    const group = await tx.group.findMany({
      where: subjectFocus
        ? {
            subjectFocus: {
              equals: subjectFocus,
              mode: "insensitive",
            },
          }
        : {},
      include: {
        members: true,
      },
    });

    const availableGroups = group.filter(
      (group) => group.members.length < group.maxSize
    );
    const sortedgroups = availableGroups.sort(
      (a, b) => b.maxSize - b.members.length - (a.maxSize - a.members.length)
    );
    const suggestedgroups = sortedgroups.map((group) => ({
      id: group.id,
      name: group.name,
      subjectFocus: group.subjectFocus,
      currentMembers: group.members.length,
      maxSize: group.maxSize,
      availableSpots: group.maxSize - group.members.length,
    }));

    return {
      userId,
      subjectFocus: subjectFocus || "All subjects",
      totalSuggestions: suggestedgroups.length,
      suggestedgroups,
    };
  });
}
