import { Router } from 'express';
import { LocationRepository } from '../db/repositories/LocationRepository';
import { AuditRepository } from '../db/repositories/AuditRepository';
import { requireAdminPermission } from '../auth/authManager';

export const locationRouter = Router();

// 1. Public: Get full location catalog
locationRouter.get('/', async (req, res) => {
  try {
    const locations = await LocationRepository.getAll();
    res.json({ success: true, locations });
  } catch (err: any) {
    console.error('Error fetching locations:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch location catalog.' });
  }
});

// 2. Admin: Add a new city with province
locationRouter.post('/cities', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { provinceName, cityName, districts } = req.body;
    if (!cityName || !cityName.trim()) {
      return res.status(400).json({ success: false, message: 'City name is required.' });
    }
    if (!provinceName || !provinceName.trim()) {
      return res.status(400).json({ success: false, message: 'Province selection is required.' });
    }

    const result = await LocationRepository.addCity(provinceName, cityName, districts);
    if (!result.success) {
      return res.status(400).json(result);
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: (req as any).user?.role || 'Admin',
      action: 'Location City Added',
      target: `${cityName.trim()} (${provinceName.trim()})`,
      status: 'Success'
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error('Error adding city:', err);
    res.status(500).json({ success: false, message: err.message || 'Error adding city to catalog.' });
  }
});

// 3. Admin: Check city usage in existing jobs (for pre-edit warning)
locationRouter.get('/cities/:cityName/usage', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const rawCity = req.params.cityName;
    const usage = await LocationRepository.checkCityUsage(rawCity);
    res.json({ success: true, cityName: rawCity, ...usage });
  } catch (err: any) {
    console.error('Error checking city usage:', err);
    res.status(500).json({ success: false, message: 'Error checking city usage.' });
  }
});

// 4. Admin: Edit city name and/or province mapping
locationRouter.put('/cities/:cityName', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const oldCityName = req.params.cityName;
    const { newCityName, targetProvince, districts } = req.body;

    if (!newCityName || !newCityName.trim()) {
      return res.status(400).json({ success: false, message: 'New city name is required.' });
    }
    if (!targetProvince || !targetProvince.trim()) {
      return res.status(400).json({ success: false, message: 'Target province is required.' });
    }

    const result = await LocationRepository.updateCity(
      oldCityName,
      newCityName.trim(),
      targetProvince.trim(),
      districts
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: (req as any).user?.role || 'Admin',
      action: 'Location City Updated',
      target: `${oldCityName} -> ${newCityName.trim()} in ${targetProvince.trim()}`,
      status: 'Success'
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error updating city:', err);
    res.status(500).json({ success: false, message: err.message || 'Error updating city.' });
  }
});

// 5. Admin: Delete city from master catalog (preserves historical job records)
locationRouter.delete('/cities/:cityName', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const cityName = req.params.cityName;
    const result = await LocationRepository.deleteCity(cityName);
    if (!result.success) {
      return res.status(404).json(result);
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: (req as any).user?.role || 'Admin',
      action: 'Location City Deleted',
      target: cityName,
      status: 'Success'
    });

    res.json(result);
  } catch (err: any) {
    console.error('Error deleting city:', err);
    res.status(500).json({ success: false, message: err.message || 'Error deleting city.' });
  }
});

// 6. Admin: Add new province
locationRouter.post('/provinces', requireAdminPermission('jobs.manage'), async (req, res) => {
  try {
    const { provinceName } = req.body;
    if (!provinceName || !provinceName.trim()) {
      return res.status(400).json({ success: false, message: 'Province name is required.' });
    }

    const result = await LocationRepository.addProvince(provinceName.trim());
    if (!result.success) {
      return res.status(400).json(result);
    }

    AuditRepository.add({
      user: (req as any).user?.name || 'Administrator',
      role: (req as any).user?.role || 'Admin',
      action: 'Location Province Added',
      target: provinceName.trim(),
      status: 'Success'
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error('Error adding province:', err);
    res.status(500).json({ success: false, message: err.message || 'Error adding province.' });
  }
});
