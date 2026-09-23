"use strict";

const offer =
  require("../commerce/customer-offer");

function parseAllowlist(
  value,
) {
  return new Set(
    String(value || "")
      .split(",")
      .map((email) =>
        email.trim().toLowerCase(),
      )
      .filter(Boolean),
  );
}

function createAdminDashboardService({
  auth,
  entitlements,
  adminEmails = "",
} = {}) {
  if (!auth) {
    throw new Error(
      "auth-required",
    );
  }

  if (!entitlements) {
    throw new Error(
      "entitlements-required",
    );
  }

  const allowlist =
    parseAllowlist(
      adminEmails,
    );

  function isAdmin({
    userId,
    email,
  }) {
    const normalized =
      String(email || "")
        .trim()
        .toLowerCase();

    return Boolean(
      userId &&
        normalized &&
        allowlist.has(
          normalized,
        ),
    );
  }

  function authorize({
    accessToken,
  }) {
    const user =
      auth.authorize({
        accessToken,
      });

    if (!user.ok) {
      return user;
    }

    if (
      !isAdmin(user)
    ) {
      return {
        ok: false,
        error:
          "admin-required",
        status: 403,
      };
    }

    return user;
  }

  function snapshot({
    accessToken,
  }) {
    const admin =
      authorize({
        accessToken,
      });

    if (!admin.ok) {
      return admin;
    }

    const users =
      auth.listUsersPublic();

    const entitlementRecords =
      new Map(
        entitlements
          .listPublic()
          .map((item) => [
            item.userId,
            item,
          ]),
      );

    const customers =
      users
        .map((user) => {
          const entitlement =
            entitlementRecords.get(
              user.userId,
            );

          const paid =
            Boolean(
              entitlement,
            ) &&
            entitlement.status !==
              "none";

          return {
            userId:
              user.userId,

            email:
              user.email,

            emailVerified:
              user.emailVerified,

            createdAt:
              user.createdAt,

            plan: paid
              ? "PairProof Pro"
              : "Free",

            status:
              entitlement?.status ||
              "none",

            subscribedAt:
              entitlement?.purchasedAt ||
              null,

            remaining:
              entitlement?.remaining ||
              0,

            total:
              entitlement?.total ||
              0,

            maxFilesPerRun:
              entitlement?.maxFilesPerRun ||
              null,

            offerVersion:
              entitlement?.offerVersion ||
              null,
          };
        })
        .sort(
          (a, b) =>
            (
              b.subscribedAt ||
              b.createdAt
            ) -
            (
              a.subscribedAt ||
              a.createdAt
            ),
        );

    const paidUsers =
      customers.filter(
        (customer) =>
          customer.total >
          0,
      );

    const activeUsers =
      customers.filter(
        (customer) =>
          customer.status ===
          "active",
      );

    const paymentExceptions =
      customers.filter(
        (customer) =>
          [
            "refunded",
            "disputed",
          ].includes(
            customer.status,
          ),
      );

    const approvedOffer =
      offer.getApprovedOffer();

    return {
      ok: true,

      admin: {
        userId:
          admin.userId,
        email:
          admin.email,
      },

      generatedAt:
        Date.now(),

      metrics: {
        totalUsers:
          customers.length,

        verifiedUsers:
          customers.filter(
            (customer) =>
              customer.emailVerified,
          ).length,

        paidUsers:
          paidUsers.length,

        activeSubscriptions:
          activeUsers.length,

        refundedUsers:
          paymentExceptions.length,

        totalRunsRemaining:
          paidUsers.reduce(
            (
              sum,
              customer,
            ) =>
              sum +
              customer.remaining,
            0,
          ),

        totalRunsPurchased:
          paidUsers.reduce(
            (
              sum,
              customer,
            ) =>
              sum +
              customer.total,
            0,
          ),
      },

      customers,

      plan: {
        name:
          "PairProof Pro",

        priceUsd:
          approvedOffer.priceUsd,

        runsIncluded:
          approvedOffer.runsIncluded,

        maxFilesPerRun:
          approvedOffer.maxFilesPerRun,

        deviceLimit:
          approvedOffer.deviceLimit,

        hostedOperabilityMonths:
          approvedOffer.hostedOperabilityMonths,
      },
    };
  }

  return {
    isAdmin,
    authorize,
    snapshot,
  };
}

module.exports = {
  createAdminDashboardService,
};