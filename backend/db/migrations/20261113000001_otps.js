/**
 * otps — one-time passwords for mobile login.
 * Hash stored (sha256), 5-minute expiry, attempt counter for brute-force guard.
 */
exports.up = async function up(knex) {
  await knex.schema.createTable('otps', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.string('mobile', 15).notNullable();
    t.string('otp_hash', 64).notNullable();
    t.integer('attempts').notNullable().defaultTo(0);
    t.timestamp('expires_at').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index(['mobile']);
    t.index(['expires_at']);
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('otps');
};
