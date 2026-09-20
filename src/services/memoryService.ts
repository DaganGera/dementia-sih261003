import { FamiliarPerson, FamiliarPlace } from '../types';
import { OfflineStorage } from '../offline/offlineStorage';
import { StorageService } from './storage';
import { syncManager } from '../offline/syncManager';

export const MemoryService = {
  async addFamiliarPerson(person: Omit<FamiliarPerson, 'id'>, patientId?: string): Promise<FamiliarPerson> {
    const pid = patientId || StorageService.getActivePatientId();
    const newPerson = StorageService.addFamiliarPerson(person, pid);
    try {
      await OfflineStorage.saveMemory({
        id: newPerson.id,
        patient_id: pid,
        category: 'family',
        title: newPerson.name,
        content: newPerson.notes || newPerson.relationship,
        person_name: newPerson.name,
        metadata: { photoUrl: newPerson.photoUrl, relationship: newPerson.relationship },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Offline memory save warning', e);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }

    return newPerson;
  },

  async addFamiliarPlace(place: Omit<FamiliarPlace, 'id'>, patientId?: string): Promise<FamiliarPlace> {
    const pid = patientId || StorageService.getActivePatientId();
    const newPlace = StorageService.addFamiliarPlace(place, pid);
    try {
      await OfflineStorage.saveMemory({
        id: newPlace.id,
        patient_id: pid,
        category: 'place',
        title: newPlace.name,
        content: newPlace.description,
        place_name: newPlace.name,
        metadata: { photoUrl: newPlace.photoUrl },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Offline place memory save warning', e);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      syncManager.startSync().catch(() => {});
    }

    return newPlace;
  },
};
