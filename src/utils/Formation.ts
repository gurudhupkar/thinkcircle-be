// import { PrismaClient } from "@prisma/client";

// const prisma = new PrismaClient();

// export async function formGroups() {

//   const ungroupedProfiles = await prisma.profile.findMany({
//     where: { groupId: null },
//   });

//   for (const profile of ungroupedProfiles) {

//     let assigned = false;

//     for (const subject of profile.subjects) {
//       let group = await prisma.group.findFirst({
//         where: { subjectFocus: subject },
//       });

//       if (!group) {
//         group = await prisma.group.create({
//           data: {
//             name: `${subject} Study Group`,
//             subjectFocus: subject,
//             createdByAI: true,
//           },
//         });
//       }

//       await prisma.profile.update({
//         where: { id: profile.id },
//         data: { groupId: group.id },
//       });

//       assigned = true;
//       break;
//     }

//     if (!assigned) {
//       console.log(`No suitable group found for profile ${profile.id}`);
//     }
//   }

//   return { message: "Groups formed successfully!" };
// }
