"use strict";

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "oncall_calendars",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          timezone: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "UTC",
          },
          notifyHour: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 9,
          },
          slackWebhookUrl: {
            type: Sequelize.BLOB,
            allowNull: true,
          },
          teamId: {
            type: Sequelize.UUID,
            allowNull: false,
            onDelete: "cascade",
            references: {
              model: "teams",
            },
          },
          createdById: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "users",
            },
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          deletedAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },
        },
        { transaction }
      );
      await queryInterface.addIndex("oncall_calendars", ["teamId"], {
        transaction,
      });

      await queryInterface.createTable(
        "oncall_rotations",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
          },
          calendarId: {
            type: Sequelize.UUID,
            allowNull: false,
            onDelete: "cascade",
            references: {
              model: "oncall_calendars",
            },
          },
          name: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          color: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          startDate: {
            type: Sequelize.DATEONLY,
            allowNull: false,
          },
          startDayOfWeek: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
          },
          shiftLengthDays: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 7,
          },
          notifyOnChange: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          lastNotifiedDate: {
            type: Sequelize.DATEONLY,
            allowNull: true,
          },
          index: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          deletedAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },
        },
        { transaction }
      );
      await queryInterface.addIndex("oncall_rotations", ["calendarId"], {
        transaction,
      });
      await queryInterface.addIndex("oncall_rotations", ["notifyOnChange"], {
        transaction,
        where: { notifyOnChange: true, deletedAt: null },
      });

      await queryInterface.createTable(
        "oncall_rotation_segments",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
          },
          rotationId: {
            type: Sequelize.UUID,
            allowNull: false,
            onDelete: "cascade",
            references: {
              model: "oncall_rotations",
            },
          },
          effectiveDate: {
            type: Sequelize.DATEONLY,
            allowNull: false,
          },
          memberIds: {
            type: Sequelize.ARRAY(Sequelize.UUID),
            allowNull: false,
            defaultValue: [],
          },
          startIndex: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 0,
          },
          shiftLengthDays: {
            type: Sequelize.INTEGER,
            allowNull: false,
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );
      await queryInterface.addIndex(
        "oncall_rotation_segments",
        ["rotationId", "effectiveDate"],
        { unique: true, transaction }
      );

      await queryInterface.createTable(
        "oncall_overrides",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
          },
          rotationId: {
            type: Sequelize.UUID,
            allowNull: false,
            onDelete: "cascade",
            references: {
              model: "oncall_rotations",
            },
          },
          userId: {
            type: Sequelize.UUID,
            allowNull: false,
            onDelete: "cascade",
            references: {
              model: "users",
            },
          },
          createdById: {
            type: Sequelize.UUID,
            allowNull: false,
            references: {
              model: "users",
            },
          },
          startDate: {
            type: Sequelize.DATEONLY,
            allowNull: false,
          },
          endDate: {
            type: Sequelize.DATEONLY,
            allowNull: false,
          },
          reason: {
            type: Sequelize.STRING,
            allowNull: true,
          },
          createdAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
          updatedAt: {
            type: Sequelize.DATE,
            allowNull: false,
          },
        },
        { transaction }
      );
      await queryInterface.addIndex(
        "oncall_overrides",
        ["rotationId", "startDate", "endDate"],
        { transaction }
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("oncall_overrides", { transaction });
      await queryInterface.dropTable("oncall_rotation_segments", {
        transaction,
      });
      await queryInterface.dropTable("oncall_rotations", { transaction });
      await queryInterface.dropTable("oncall_calendars", { transaction });
    });
  },
};
