const express = require('express');
const db = require('../db');
const { requireAuth, requireEmailVerified } = require('../middleware/auth');
const { money } = require('../utils/money');
const { hasFeature, upgradeError } = require('../utils/features');

const router = express.Router();
router.use(requireAuth);
router.use(requireEmailVerified);

const UNIT_TYPES = ['piece', 'bottle', 'meter', 'kg', 'litre', 'pair', 'box', 'service'];

function serializeItem(item) {
  const quantity = Number(item.quantity_in_stock || 0);
  const reorder = Number(item.reorder_level || 0);
  return {
    ...item,
    unit_price: Number(item.unit_price || 0),
    quantity_in_stock: quantity,
    reorder_level: reorder,
    low_stock: quantity <= reorder,
    status: quantity <= reorder ? 'low' : 'ok',
  };
}

function requireInventory(req) {
  if (!hasFeature(req.user, 'inventory')) {
    throw upgradeError('Upgrade to Basic (KSh 500/month) for inventory tracking');
  }
}

router.get('/', async (req, res, next) => {
  try {
    if (!hasFeature(req.user, 'inventory')) {
      return res.json({ items: [], upgrade_required: true });
    }
    const items = await db('inventory_items')
      .where({ user_id: req.user.id })
      .orderBy('name', 'asc');
    return res.json({ items: items.map(serializeItem), upgrade_required: false });
  } catch (err) {
    return next(err);
  }
});

router.get('/low-stock', async (req, res, next) => {
  try {
    if (!hasFeature(req.user, 'inventory')) {
      return res.json({ items: [], count: 0, upgrade_required: true });
    }
    const items = await db('inventory_items')
      .where({ user_id: req.user.id })
      .andWhereRaw('quantity_in_stock <= reorder_level')
      .orderBy('quantity_in_stock', 'asc');
    return res.json({
      items: items.map(serializeItem),
      count: items.length,
      upgrade_required: false,
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    requireInventory(req);
    const name = String(req.body.name || '').trim();
    const sku = String(req.body.sku || '').trim() || null;
    const unit_type = String(req.body.unit_type || 'piece').trim();
    const unit_price = money(req.body.unit_price);
    const quantity_in_stock = Number.parseInt(req.body.quantity_in_stock, 10);
    const reorder_level = Number.parseInt(req.body.reorder_level, 10);

    if (!name) {
      return res.status(400).json({ error: 'Item name is required' });
    }
    if (!Number.isFinite(unit_price) || unit_price < 0) {
      return res.status(400).json({ error: 'Unit price must be 0 or more' });
    }
    if (!Number.isInteger(quantity_in_stock) || quantity_in_stock < 0) {
      return res.status(400).json({ error: 'Quantity must be 0 or more' });
    }
    if (!Number.isInteger(reorder_level) || reorder_level < 0) {
      return res.status(400).json({ error: 'Reorder level must be 0 or more' });
    }
    if (!UNIT_TYPES.includes(unit_type)) {
      return res.status(400).json({ error: 'Choose a valid unit type' });
    }

    const [item] = await db('inventory_items')
      .insert({
        user_id: req.user.id,
        name,
        sku,
        unit_price,
        quantity_in_stock,
        reorder_level,
        unit_type,
      })
      .returning('*');

    return res.status(201).json({ item: serializeItem(item) });
  } catch (err) {
    return next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    requireInventory(req);
    const existing = await db('inventory_items')
      .where({ id: req.params.id, user_id: req.user.id })
      .first();
    if (!existing) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    const updates = { updated_at: db.fn.now() };
    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) return res.status(400).json({ error: 'Item name is required' });
      updates.name = name;
    }
    if (req.body.sku !== undefined) {
      updates.sku = String(req.body.sku || '').trim() || null;
    }
    if (req.body.unit_price !== undefined) {
      const unit_price = money(req.body.unit_price);
      if (unit_price < 0) return res.status(400).json({ error: 'Unit price must be 0 or more' });
      updates.unit_price = unit_price;
    }
    if (req.body.quantity_in_stock !== undefined) {
      const quantity_in_stock = Number.parseInt(req.body.quantity_in_stock, 10);
      if (!Number.isInteger(quantity_in_stock) || quantity_in_stock < 0) {
        return res.status(400).json({ error: 'Quantity must be 0 or more' });
      }
      updates.quantity_in_stock = quantity_in_stock;
    }
    if (req.body.reorder_level !== undefined) {
      const reorder_level = Number.parseInt(req.body.reorder_level, 10);
      if (!Number.isInteger(reorder_level) || reorder_level < 0) {
        return res.status(400).json({ error: 'Reorder level must be 0 or more' });
      }
      updates.reorder_level = reorder_level;
    }
    if (req.body.unit_type !== undefined) {
      const unit_type = String(req.body.unit_type || '').trim();
      if (!UNIT_TYPES.includes(unit_type)) {
        return res.status(400).json({ error: 'Choose a valid unit type' });
      }
      updates.unit_type = unit_type;
    }

    const [item] = await db('inventory_items').where({ id: existing.id }).update(updates).returning('*');
    return res.json({ item: serializeItem(item) });
  } catch (err) {
    return next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    requireInventory(req);
    const deleted = await db('inventory_items')
      .where({ id: req.params.id, user_id: req.user.id })
      .del();
    if (!deleted) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
