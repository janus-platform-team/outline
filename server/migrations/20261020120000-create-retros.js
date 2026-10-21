module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.createTable(
        "retros",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
          },
          title: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          phase: {
            type: Sequelize.STRING,
            allowNull: false,
            defaultValue: "brainstorm",
          },
          anonymous: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
          },
          votesPerUser: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 5,
          },
          columns: {
            type: Sequelize.JSONB,
            allowNull: false,
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
          collectionId: {
            type: Sequelize.UUID,
            allowNull: true,
            onDelete: "set null",
            references: {
              model: "collections",
            },
          },
          documentId: {
            type: Sequelize.UUID,
            allowNull: true,
            onDelete: "set null",
            references: {
              model: "documents",
            },
          },
          closedAt: {
            type: Sequelize.DATE,
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
          deletedAt: {
            type: Sequelize.DATE,
            allowNull: true,
          },
        },
        { transaction }
      );
      await queryInterface.addIndex("retros", ["teamId", "createdAt"], {
        transaction,
      });

      await queryInterface.createTable(
        "retro_cards",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
          },
          retroId: {
            type: Sequelize.UUID,
            allowNull: false,
            onDelete: "cascade",
            references: {
              model: "retros",
            },
          },
          authorId: {
            type: Sequelize.UUID,
            allowNull: false,
            onDelete: "cascade",
            references: {
              model: "users",
            },
          },
          columnId: {
            type: Sequelize.STRING,
            allowNull: false,
          },
          text: {
            type: Sequelize.TEXT,
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
      await queryInterface.addIndex("retro_cards", ["retroId"], {
        transaction,
      });

      await queryInterface.createTable(
        "retro_votes",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
          },
          retroId: {
            type: Sequelize.UUID,
            allowNull: false,
            onDelete: "cascade",
            references: {
              model: "retros",
            },
          },
          cardId: {
            type: Sequelize.UUID,
            allowNull: false,
            onDelete: "cascade",
            references: {
              model: "retro_cards",
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
      await queryInterface.addIndex("retro_votes", ["cardId", "userId"], {
        unique: true,
        transaction,
      });
      await queryInterface.addIndex("retro_votes", ["retroId", "userId"], {
        transaction,
      });

      await queryInterface.createTable(
        "retro_action_items",
        {
          id: {
            type: Sequelize.UUID,
            allowNull: false,
            primaryKey: true,
          },
          retroId: {
            type: Sequelize.UUID,
            allowNull: false,
            onDelete: "cascade",
            references: {
              model: "retros",
            },
          },
          assigneeId: {
            type: Sequelize.UUID,
            allowNull: true,
            onDelete: "set null",
            references: {
              model: "users",
            },
          },
          text: {
            type: Sequelize.TEXT,
            allowNull: false,
          },
          completed: {
            type: Sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: false,
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
      await queryInterface.addIndex("retro_action_items", ["retroId"], {
        transaction,
      });
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.dropTable("retro_action_items", { transaction });
      await queryInterface.dropTable("retro_votes", { transaction });
      await queryInterface.dropTable("retro_cards", { transaction });
      await queryInterface.dropTable("retros", { transaction });
    });
  },
};
