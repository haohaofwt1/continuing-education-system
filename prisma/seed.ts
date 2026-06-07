import { PrismaClient, CertificateReviewStatus, ConversationType, OcrStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const permissions = [
  "personnel.view",
  "personnel.manage",
  "certificates.view",
  "certificates.create",
  "certificates.approve",
  "certificates.reject",
  "certificates.delete",
  "reports.export",
  "reports.unit",
  "reports.department",
  "reports.create",
  "reports.share",
  "catalog.manage",
  "api_keys.manage",
  "settings.manage",
  "ai.chat",
  "ai.act"
];

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Organization",
      slug: "default",
      plan: "HOSPITAL",
      status: "ACTIVE",
      maxUsers: 500,
      maxCertificatesPerMonth: 5000,
      maxOcrPagesPerMonth: 5000,
      maxAiMessagesPerMonth: 2000,
      maxStorageGb: 100
    }
  });

  const permissionRows = [];
  for (const key of permissions) {
    permissionRows.push(
      await prisma.permission.upsert({
        where: { key },
        update: {},
        create: { key, description: key }
      })
    );
  }

  const adminRole = await prisma.role.upsert({
      where: { name: "Super Admin" },
      update: {},
      create: {
      tenantId: tenant.id,
      name: "Super Admin",
      description: "Toan quyen he thong",
      permissions: { connect: permissionRows.map((permission) => ({ id: permission.id })) }
    }
  });

  const reviewerRole = await prisma.role.upsert({
      where: { name: "Nguoi kiem duyet" },
      update: {},
      create: {
      tenantId: tenant.id,
      name: "Nguoi kiem duyet",
      permissions: {
        connect: permissionRows
          .filter((permission) => permission.key.startsWith("certificates") || permission.key.startsWith("reports"))
          .map((permission) => ({ id: permission.id }))
      }
    }
  });

  const employeeRole = await prisma.role.upsert({
      where: { name: "Nhan vien" },
      update: {},
      create: {
      tenantId: tenant.id,
      name: "Nhan vien",
      permissions: {
        connect: permissionRows
          .filter((permission) => ["certificates.view", "certificates.create"].includes(permission.key))
          .map((permission) => ({ id: permission.id }))
      }
    }
  });

  const departments = await Promise.all(
    ["Phong kham", "Phong xet nghiem", "Phong chan doan hinh anh", "Phong Duoc"].map((name, index) =>
      prisma.department.upsert({
        where: { name },
        update: {},
        create: { tenantId: tenant.id, name, code: `D${index + 1}` }
      })
    )
  );

  const positions = await Promise.all(
    [
      ["Bac si", 120],
      ["Duoc si", 120],
      ["Dieu duong", 120],
      ["Ky thuat vien", 120],
      ["Nu ho sinh", 120],
      ["Y si", 120]
    ].map(([name, requiredHours]) =>
      prisma.position.upsert({
        where: { name: String(name) },
        update: { requiredHours: Number(requiredHours) },
        create: { tenantId: tenant.id, name: String(name), requiredHours: Number(requiredHours) }
      })
    )
  );

  const certificateTypes = await Promise.all(
    ["Dao tao lien tuc", "Kiem soat nhiem khuan", "Cap cuu", "An toan nguoi benh", "Duoc lam sang"].map((name) =>
      prisma.certificateType.upsert({
        where: { name },
        update: {},
        create: { tenantId: tenant.id, name, required: name === "Kiem soat nhiem khuan" }
      })
    )
  );

  const cycle =
    (await prisma.trainingCycle.findFirst({ where: { startYear: 2025, endYear: 2026 } })) ??
    (await prisma.trainingCycle.create({
      data: {
        name: "Chu ky 2025-2026",
        tenantId: tenant.id,
        startYear: 2025,
        endYear: 2026,
        requiredHours: 48,
        isActive: true
      }
    }));

  const passwordHash = await bcrypt.hash(process.env.SUPER_ADMIN_PASSWORD || "ChangeMe123!", 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.SUPER_ADMIN_EMAIL || "admin@example.com" },
    update: { passwordHash },
    create: {
      name: "Quan tri he thong",
      tenantId: tenant.id,
      username: "admin",
      email: process.env.SUPER_ADMIN_EMAIL || "admin@example.com",
      passwordHash,
      departmentId: departments[0].id,
      positionId: positions[0].id,
      roleId: adminRole.id,
      licenseNumber: "CCHN-0001"
    }
  });

  const names = [
    "Nguyen Van An",
    "Tran Thi Binh",
    "Le Quoc Cuong",
    "Pham Minh Chau",
    "Hoang Thi Dung",
    "Do Thanh Hai",
    "Vo Ngoc Lan",
    "Bui Duc Minh",
    "Dang Thu Nga",
    "Mai Anh Tuan"
  ];

  const users = await Promise.all(
    names.map((name, index) =>
      prisma.user.upsert({
        where: { email: `user${index + 1}@example.com` },
        update: { passwordHash },
        create: {
          name,
          tenantId: tenant.id,
          username: `user${index + 1}`,
          email: `user${index + 1}@example.com`,
          phone: `09000000${index}`,
          passwordHash,
          departmentId: departments[index % departments.length].id,
          positionId: positions[index % positions.length].id,
          roleId: index % 4 === 0 ? reviewerRole.id : employeeRole.id,
          licenseNumber: index % 3 === 0 ? null : `CCHN-${1000 + index}`,
          licenseIssuedAt: new Date("2024-01-15")
        }
      })
    )
  );

  const statuses = [
    CertificateReviewStatus.APPROVED,
    CertificateReviewStatus.PENDING_REVIEW,
    CertificateReviewStatus.MISSING_INFO,
    CertificateReviewStatus.EXPIRING_SOON,
    CertificateReviewStatus.EXPIRED
  ];

  await Promise.all(
    users.slice(0, 8).map((user, index) =>
      prisma.certificate.upsert({
        where: {
          tenantId_certificateCode: {
            tenantId: tenant.id,
            certificateCode: `CERT-${2026}-${index + 1}`
          }
        },
        update: {},
        create: {
          title: index % 2 === 0 ? "Kiem soat nhiem khuan co ban" : "Dao tao lien tuc cap nhat chuyen mon",
          tenantId: tenant.id,
          holderId: user.id,
          departmentId: user.departmentId,
          positionId: user.positionId,
          certificateTypeId: certificateTypes[index % certificateTypes.length].id,
          trainingCycleId: cycle.id,
          issuingOrganization: index % 2 === 0 ? "Benh vien Trung tam" : "Truong Dai hoc Y Duoc",
          issuedDate: new Date(`2026-0${(index % 5) + 1}-10`),
          expiredDate: index === 4 ? new Date("2026-06-15") : index === 5 ? new Date("2025-12-31") : null,
          creditHours: [12, 24, 8, 16, 32][index % 5],
          certificateCode: `CERT-${2026}-${index + 1}`,
          fileUrl: `/uploads/cert-${index + 1}.pdf`,
          thumbnailUrl: `/placeholder-certificate.svg`,
          ocrStatus: OcrStatus.SUCCEEDED,
          reviewStatus: statuses[index % statuses.length],
          confidence: 0.82 + index * 0.01,
          courseContent: "Cap nhat kien thuc chuyen mon va an toan nguoi benh",
          includeInCycle: index !== 6
        }
      })
    )
  );

  await prisma.trainingSummary.createMany({
    data: users.map((user, index) => {
      const approvedHours = [12, 24, 48, 32, 8, 56, 20, 44, 0, 16][index];
      return {
        userId: user.id,
        cycleId: cycle.id,
        approvedHours,
        requiredHours: 48,
        missingHours: Math.max(48 - approvedHours, 0),
        compliant: approvedHours >= 48
      };
    }),
    skipDuplicates: true
  });

  await prisma.setting.upsert({
    where: { key: "system" },
    update: {},
    create: {
      key: "system",
      tenantId: tenant.id,
      value: {
        appName: "He thong Dao tao Lien tuc",
        brandColor: "teal",
        defaultRequiredHours: 48,
        cycleStartYear: 2025,
        cycleEndYear: 2026,
        ocrProvider: "mock",
        storageProvider: "local"
      }
    }
  });

  for (const notification of [
    {
      userId: admin.id,
      type: "MISSING_HOURS" as const,
      title: "15 nguoi thieu so tiet",
      message: "Can ra soat nhan su chua dat chu ky 2025-2026."
    },
    {
      userId: admin.id,
      type: "CERTIFICATE_EXPIRING" as const,
      title: "8 chung chi sap het han",
      message: "Co chung chi het han trong 60 ngay toi."
    }
  ]) {
    const exists = await prisma.notification.findFirst({
      where: { userId: notification.userId, type: notification.type, title: notification.title }
    });
    if (!exists) await prisma.notification.create({ data: notification });
  }

  const discussUsers = [admin, ...users].slice(0, 12);
  for (const channel of [
    { name: "All", description: "Kenh chung toan don vi", body: "Chao mung moi nguoi den kenh trao doi noi bo." },
    { name: "Administrators", description: "Trao doi quan tri he thong", body: "Kenh danh cho quan tri vien va nguoi kiem duyet." },
    { name: "Dao tao lien tuc", description: "Nhac ho so, chung chi, so tiet", body: "Dung kenh nay de hoi nhanh ve chung chi va chu ky dao tao." }
  ]) {
    let conversation = await prisma.conversation.findFirst({
      where: { type: ConversationType.CHANNEL, name: channel.name }
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          type: ConversationType.CHANNEL,
          name: channel.name,
          description: channel.description,
          createdById: admin.id,
          members: { create: discussUsers.map((user) => ({ userId: user.id })) }
        }
      });
    }
    const hasMessage = await prisma.message.findFirst({
      where: { conversationId: conversation.id, body: channel.body }
    });
    if (!hasMessage) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          authorId: admin.id,
          body: channel.body
        }
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
