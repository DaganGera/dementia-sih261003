import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { StorageService } from './storage';
import { FamiliarPerson, FamiliarPlace, Reminder } from '../types';

export interface MemoryAssistantResources {
  patientId: string;
  patientName: string;
  people: FamiliarPerson[];
  places: FamiliarPlace[];
  routines: Array<{ id: string; time: string; title: string; description?: string }>;
  reminders: Reminder[];
  caregiverName: string;
  emergencyPhone: string;
  relationship?: string;
  isLoading: boolean;
}

export interface DynamicQuestion {
  id: string;
  label: string;
  query: string;
}

const DUMMY_IDS = new Set(['fp-1', 'fp-2', 'fp-3', 'fplace-1', 'fplace-2', 'fplace-3', 'rem-1', 'rem-2', 'rem-3']);

const format12HourTime = (timeStr: string): string => {
  if (!timeStr) return '08:00 AM';
  const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const modifier = hours >= 12 ? 'PM' : 'AM';
    if (hours > 12) hours -= 12;
    if (hours === 0) hours = 12;
    return `${hours.toString().padStart(2, '0')}:${minutes} ${modifier}`;
  }
  return timeStr;
};

export const MemoryAssistantEngine = {
  async fetchPatientResources(patientId?: string, authUserId?: string): Promise<MemoryAssistantResources> {
    const resolvedPid =
      patientId ||
      StorageService.getActivePatientId(authUserId) ||
      (authUserId ? authUserId : 'pat-demo-1');

    const result: MemoryAssistantResources = {
      patientId: resolvedPid,
      patientName: 'Patient',
      people: [],
      places: [],
      routines: [],
      reminders: [],
      caregiverName: '',
      emergencyPhone: '',
      relationship: '',
      isLoading: false,
    };

    const candidateIds = new Set<string>();
    if (resolvedPid && resolvedPid !== 'pat-demo-1') {
      candidateIds.add(resolvedPid);
    }
    if (authUserId) {
      candidateIds.add(authUserId);
    }

    if (isSupabaseConfigured() && candidateIds.size > 0) {
      try {
        const searchIds = Array.from(candidateIds);
        const { data: pats } = await supabase
          .from('patients')
          .select('id, user_id, full_name, emergency_contact_name, emergency_contact_phone, medical_history')
          .or(searchIds.map(id => `id.eq.${id},user_id.eq.${id}`).join(','));

        if (pats && pats.length > 0) {
          for (const p of pats) {
            if (p.id) candidateIds.add(p.id);
            if (p.full_name) result.patientName = p.full_name;
            if (p.emergency_contact_name) result.caregiverName = p.emergency_contact_name;
            if (p.emergency_contact_phone) result.emergencyPhone = p.emergency_contact_phone;

            if (p.medical_history) {
              try {
                const med = typeof p.medical_history === 'string' ? JSON.parse(p.medical_history) : p.medical_history;
                if (med?.familiarPeople && Array.isArray(med.familiarPeople)) {
                  for (const fp of med.familiarPeople) {
                    if (fp && !DUMMY_IDS.has(fp.id) && fp.name && !fp.name.includes('Demo')) {
                      result.people.push(fp);
                    }
                  }
                }
                if (med?.familiarPlaces && Array.isArray(med.familiarPlaces)) {
                  for (const fpl of med.familiarPlaces) {
                    if (fpl && !DUMMY_IDS.has(fpl.id) && fpl.name) {
                      result.places.push(fpl);
                    }
                  }
                }
              } catch {}
            }
          }
        }

        const { data: cgLinks } = await supabase
          .from('caregiver_patients')
          .select('patient_id, caregiver_id, relationship')
          .or(searchIds.map(id => `caregiver_id.eq.${id},patient_id.eq.${id}`).join(','));

        if (cgLinks && cgLinks.length > 0) {
          for (const link of cgLinks) {
            if (link.patient_id) candidateIds.add(link.patient_id);
            if (link.relationship) result.relationship = link.relationship;
          }
        }

        const queryIds = Array.from(candidateIds).filter(id => id && id !== 'pat-demo-1');

        if (queryIds.length > 0) {
          const { data: memoriesData, error: memErr } = await supabase
            .from('memories')
            .select('*')
            .in('patient_id', queryIds);

          if (!memErr && memoriesData && memoriesData.length > 0) {
            for (const m of memoriesData) {
              if (DUMMY_IDS.has(m.id)) continue;
              if (m.category === 'family') {
                const personName = m.person_name || m.title || '';
                if (personName && !result.people.some(p => p.name.toLowerCase() === personName.toLowerCase())) {
                  result.people.push({
                    id: m.id,
                    name: personName,
                    relationship: (m.metadata && m.metadata.relationship) || m.content || '',
                    photoUrl: (m.metadata && m.metadata.photoUrl) || '',
                    notes: m.content || '',
                  });
                }
              } else if (m.category === 'place') {
                const placeName = m.place_name || m.title || '';
                if (placeName && !result.places.some(p => p.name.toLowerCase() === placeName.toLowerCase())) {
                  result.places.push({
                    id: m.id,
                    name: placeName,
                    description: m.content || '',
                    photoUrl: (m.metadata && m.metadata.photoUrl) || '',
                  });
                }
              }
            }
          }

          const { data: routinesData, error: routErr } = await supabase
            .from('routines')
            .select('*')
            .in('patient_id', queryIds)
            .order('scheduled_time', { ascending: true });

          if (!routErr && routinesData && routinesData.length > 0) {
            for (const r of routinesData) {
              if (DUMMY_IDS.has(r.id)) continue;
              if (r.title && !r.title.includes('Anitha') && !r.title.includes('Demo')) {
                result.routines.push({
                  id: r.id,
                  time: format12HourTime(r.scheduled_time),
                  title: r.title,
                  description: r.description || '',
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('MemoryAssistantEngine: Supabase load error', err);
      }
    }

    const localPeople = StorageService.getFamiliarPeople(resolvedPid);
    for (const p of localPeople) {
      if (p && !DUMMY_IDS.has(p.id) && p.name && !result.people.some(ep => ep.name.toLowerCase() === p.name.toLowerCase())) {
        result.people.push(p);
      }
    }

    const localPlaces = StorageService.getFamiliarPlaces(resolvedPid);
    for (const pl of localPlaces) {
      if (pl && !DUMMY_IDS.has(pl.id) && pl.name && !result.places.some(epl => epl.name.toLowerCase() === pl.name.toLowerCase())) {
        result.places.push(pl);
      }
    }

    const localReminders = StorageService.getReminders(resolvedPid);
    for (const rem of localReminders) {
      if (rem && !DUMMY_IDS.has(rem.id) && rem.title && !rem.title.includes('Anitha')) {
        result.reminders.push(rem);
      }
    }

    const localProfile = StorageService.getElderlyProfile(resolvedPid);
    if (!result.patientName || result.patientName === 'Patient') {
      if (localProfile?.name && localProfile.name !== 'Meena Sharma') {
        result.patientName = localProfile.name;
      }
    }
    if (!result.caregiverName && localProfile?.caregiverName && localProfile.caregiverName !== 'Anitha') {
      result.caregiverName = localProfile.caregiverName;
    }
    if (!result.emergencyPhone && localProfile?.emergencyContact) {
      result.emergencyPhone = localProfile.emergencyContact;
    }

    return result;
  },

  generateDynamicQuestions(resources: MemoryAssistantResources, language: string): DynamicQuestion[] {
    const questions: DynamicQuestion[] = [];

    resources.people.slice(0, 3).forEach((person, idx) => {
      let label = `Who is ${person.name}?`;
      if (language === 'as') label = `${person.name} কোন হয়?`;
      else if (language === 'bn') label = `${person.name} কে?`;
      else if (language === 'ne') label = `${person.name} को हुनुहुन्छ?`;
      else if (language === 'mni') label = `${person.name} কনানো?`;
      else if (language === 'kha') label = `${person.name} u/ka dei mano?`;
      else if (language === 'lus') label = `${person.name} hi tunge?`;
      else if (language === 'nag') label = `${person.name} kun ase?`;
      else if (language === 'ny') label = `${person.name} kuni e?`;

      questions.push({
        id: `q-person-${idx}`,
        label,
        query: `who is ${person.name}`,
      });
    });

    if (resources.people.length > 0) {
      let label = 'Who is visiting me?';
      if (language === 'as') label = 'আজি মোক কোনে লগ কৰিব?';
      else if (language === 'bn') label = 'আজ কে দেখা করতে আসবে?';
      else if (language === 'ne') label = 'आज मलाई कसले भेट्न आउँछ?';
      else if (language === 'mni') label = 'ঙসি কনানা উনবা লাক্কদগে?';
      else if (language === 'kha') label = 'Mano ban wan peit ïa nga?';
      else if (language === 'lus') label = 'Vawiin ah tunge rawn kal dawn?';
      else if (language === 'nag') label = 'Aji kun ahibo?';
      else if (language === 'ny') label = 'Lwnyi kuni wlapada?';

      questions.push({
        id: 'q-family-overview',
        label,
        query: 'who is visiting me',
      });
    }

    if (resources.places.length > 0) {
      const primaryPlace = resources.places[0];
      let label = `Where is ${primaryPlace.name}?`;
      if (primaryPlace.name.toLowerCase().includes('home') || primaryPlace.name.toLowerCase().includes('house')) {
        label = 'Where is my home?';
        if (language === 'as') label = 'মোৰ ঘৰ ক’ত?';
        else if (language === 'bn') label = 'আমার বাড়ি কোথায়?';
        else if (language === 'ne') label = 'मेरो घर कहाँ छ?';
        else if (language === 'mni') label = 'ঐগী য়ুম কদাইদা লৈ?';
        else if (language === 'kha') label = 'Shaei ka ïing jong nga?';
        else if (language === 'lus') label = 'Ka in khawi ah nge a awm?';
        else if (language === 'nag') label = 'Moi laga ghar kot ase?';
        else if (language === 'ny') label = 'Ngo laga nam kot dwnam?';
      }

      questions.push({
        id: 'q-place-0',
        label,
        query: `where is ${primaryPlace.name}`,
      });
    }

    if (resources.routines.length > 0) {
      let label = 'What is my daily routine?';
      if (language === 'as') label = 'মোৰ দিনচৰ্যা কি?';
      else if (language === 'bn') label = 'আমার আজকের দিনলিপি কি?';
      else if (language === 'ne') label = 'मेरो दिनचर्या के छ?';
      else if (language === 'mni') label = 'ঐগী নোংমগী থবক পরিং কি?';
      else if (language === 'kha') label = 'Kaei ka routine jong nga?';
      else if (language === 'lus') label = 'Ka vawiin thiltum eng nge?';
      else if (language === 'nag') label = 'Moi laga routine ki ase?';
      else if (language === 'ny') label = 'Ngo laga routine hyam?';

      questions.push({
        id: 'q-routine',
        label,
        query: 'what is my daily routine',
      });
    }

    if (resources.reminders.length > 0) {
      let label = 'What reminders do I have?';
      if (language === 'as') label = 'মোৰ কি কি সোঁৱৰণী আছে?';
      else if (language === 'bn') label = 'আমার কি কি অনুস্মারক আছে?';
      else if (language === 'ne') label = 'मेरो के सम्झनाहरू छन्?';
      else if (language === 'mni') label = 'ঐগী নীংশিংহনবা করি লৈ?';
      else if (language === 'kha') label = 'Kiei ki jingpynkynmaw jong nga?';
      else if (language === 'lus') label = 'Eng hriattirnate nge ka neih?';
      else if (language === 'nag') label = 'Moi laga yaad dila ki ase?';
      else if (language === 'ny') label = 'Ngo khedapnam hyam?';

      questions.push({
        id: 'q-reminders',
        label,
        query: 'what reminders do I have',
      });
    }

    if (resources.caregiverName || resources.emergencyPhone) {
      let label = 'Who is my caregiver?';
      if (language === 'as') label = 'মোৰ সহায়ক কোন?';
      else if (language === 'bn') label = 'আমার কেয়ারগিভার কে?';
      else if (language === 'ne') label = 'मेरो हेरचाहकर्ता को हुनुहुन्छ?';
      else if (language === 'mni') label = 'ঐগী য়েন্থোকপীবা কনানো?';
      else if (language === 'kha') label = 'Mano ka nongsumar jong nga?';
      else if (language === 'lus') label = 'Ka enkawltu tunge?';
      else if (language === 'nag') label = 'Moi laga caregiver kun ase?';
      else if (language === 'ny') label = 'Ngo caregiver kuni e?';

      questions.push({
        id: 'q-caregiver',
        label,
        query: 'who is my caregiver',
      });
    }

    if (questions.length === 0) {
      questions.push(
        {
          id: 'q-guide-help',
          label: language === 'bn' ? 'আমি আপনাকে কি জিজ্ঞাসা করতে পারি?' : 'What can I ask you?',
          query: 'what can I ask you',
        },
        {
          id: 'q-guide-add',
          label: language === 'bn' ? 'স্মৃতি কিভাবে যোগ করব?' : 'How do I add memories?',
          query: 'how to add memories',
        }
      );
    }

    return questions;
  },

  processDynamicMemoryQuery(queryText: string, resources: MemoryAssistantResources, language: string): string {
    const q = queryText.toLowerCase().trim();
    const lang = language;

    // 1. Person Lookup from Supabase Resources
    for (const person of resources.people) {
      const pNameLower = person.name.toLowerCase();
      const pRelLower = (person.relationship || '').toLowerCase();

      if (
        (pNameLower && q.includes(pNameLower)) ||
        (pRelLower && q.includes(pRelLower) && (q.includes('who') || q.includes('কোনে') || q.includes('কে') || q.includes('को')))
      ) {
        const relationship = person.relationship || (lang === 'bn' ? 'পরিবারের সদস্য' : 'family member');
        const notes = person.notes ? ` ${person.notes}` : '';

        if (lang === 'as') {
          return `${person.name} আপোনাৰ ${relationship}।${notes}`;
        } else if (lang === 'bn') {
          return `${person.name} আপনার ${relationship}।${notes}`;
        } else if (lang === 'ne') {
          return `${person.name} तपाईंको ${relationship} हुनुहुन्छ।${notes}`;
        } else if (lang === 'mni') {
          return `${person.name} অদোমগী ${relationship}নি।${notes}`;
        } else if (lang === 'kha') {
          return `U/Ka ${person.name} u/ka dei u/ka ${relationship} jong phi.${notes}`;
        } else if (lang === 'lus') {
          return `${person.name} chu i ${relationship} a ni.${notes}`;
        } else if (lang === 'nag') {
          return `${person.name} toh apuni laga ${relationship} ase.${notes}`;
        } else if (lang === 'ny') {
          return `${person.name} no laga ${relationship} dwnam.${notes}`;
        } else {
          return `${person.name} is your ${relationship}.${notes}`;
        }
      }
    }

    // 2. Family Overview / Who is visiting
    if (
      q.includes('visit') ||
      q.includes('visiting') ||
      q.includes('family') ||
      q.includes('people') ||
      q.includes('কোনে') ||
      q.includes('কে আসবে') ||
      q.includes('कसले') ||
      q.includes('উনবা') ||
      q.includes('ahibo')
    ) {
      if (resources.people.length > 0) {
        const peopleList = resources.people
          .map(p => `${p.name}${p.relationship ? ` (${p.relationship})` : ''}`)
          .join(', ');

        if (lang === 'as') {
          return `আপোনাৰ পৰিয়ালৰ সদস্যসকল হৈছে: ${peopleList}।`;
        } else if (lang === 'bn') {
          return `আপনার পরিবারের প্রিয়জনেরা হলেন: ${peopleList}।`;
        } else if (lang === 'ne') {
          return `तपाईंको परिवारका सदस्यहरू: ${peopleList} हुनुहुन्छ।`;
        } else if (lang === 'mni') {
          return `অদোমগী ইমুংগী মীওইশিংদি: ${peopleList}নি।`;
        } else if (lang === 'kha') {
          return `Ki baha-ïing jong phi ki kynthup: ${peopleList}.`;
        } else if (lang === 'lus') {
          return `I chhungte chu: ${peopleList} an ni.`;
        } else if (lang === 'nag') {
          return `Apuni laga manu khan: ${peopleList} ase.`;
        } else if (lang === 'ny') {
          return `No laga manu: ${peopleList} dwnam.`;
        } else {
          return `Your familiar family members and visitors are: ${peopleList}.`;
        }
      } else {
        if (lang === 'as') {
          return 'আপোনাৰ প্ৰফাইলত এতিয়ালৈকে কোনো পৰিয়ালৰ সদস্য যোগ কৰা হোৱা নাই। আপোনাৰ সহায়কে Caregiver Dashboard ৰ পৰা যোগ কৰিব পাৰিব।';
        } else if (lang === 'bn') {
          return 'আপনার প্রোফাইলে এখনো কোনো পরিবারের সদস্য যুক্ত করা হয়নি। আপনার কেয়ারগিভার ড্যাশবোর্ড থেকে যোগ করতে পারেন।';
        } else {
          return 'No family members or visitors have been registered yet in your profile. Your caregiver can add them anytime in the Caregiver Dashboard.';
        }
      }
    }

    // 3. Place / Home Lookup
    if (
      q.includes('home') ||
      q.includes('place') ||
      q.includes('where') ||
      q.includes('live') ||
      q.includes('ঘৰ') ||
      q.includes('বাড়ি') ||
      q.includes('घर') ||
      q.includes('ïing') ||
      q.includes('kot ase')
    ) {
      for (const place of resources.places) {
        if (place.name && q.includes(place.name.toLowerCase())) {
          return `${place.name}: ${place.description || (lang === 'bn' ? 'আপনার সুন্দর পরিচিত স্থান।' : 'Your familiar place.')}`;
        }
      }

      if (resources.places.length > 0) {
        const homePlace =
          resources.places.find(p => p.name.toLowerCase().includes('home') || p.name.toLowerCase().includes('house')) ||
          resources.places[0];

        if (lang === 'as') {
          return `আপোনাৰ ঘৰ হৈছে: ${homePlace.name}। ${homePlace.description || ''}`;
        } else if (lang === 'bn') {
          return `আপনার বাড়ি: ${homePlace.name}। ${homePlace.description || ''}`;
        } else if (lang === 'ne') {
          return `तपाईंको घर: ${homePlace.name}। ${homePlace.description || ''}`;
        } else if (lang === 'mni') {
          return `অদোমগী য়ুম: ${homePlace.name}। ${homePlace.description || ''}`;
        } else if (lang === 'kha') {
          return `Ka ïing jong phi: ${homePlace.name}. ${homePlace.description || ''}`;
        } else if (lang === 'lus') {
          return `I in: ${homePlace.name}. ${homePlace.description || ''}`;
        } else if (lang === 'nag') {
          return `Apuni laga ghar: ${homePlace.name}. ${homePlace.description || ''}`;
        } else if (lang === 'ny') {
          return `No laga nam: ${homePlace.name}. ${homePlace.description || ''}`;
        } else {
          return `Your home is ${homePlace.name}.${homePlace.description ? ` ${homePlace.description}` : ''}`;
        }
      } else {
        if (lang === 'as') {
          return 'আপোনাৰ ঘৰৰ ঠিকনা এতিয়াও সংৰক্ষণ কৰা হোৱা নাই। সহায়কে Caregiver Dashboard ৰ পৰা যোগ কৰিব পাৰে।';
        } else if (lang === 'bn') {
          return 'আপনার বাড়ির ঠিকানা এখনো সংরক্ষণ করা হয়নি। কেয়ারগিভার ড্যাশবোর্ড থেকে তা যুক্ত করতে পারেন।';
        } else {
          return 'Your home location or familiar places have not been saved yet. Your caregiver can add them in the Caregiver Dashboard.';
        }
      }
    }

    // 4. Daily Routine / Schedule Lookup
    if (
      q.includes('routine') ||
      q.includes('schedule') ||
      q.includes('morning') ||
      q.includes('today') ||
      q.includes('step') ||
      q.includes('ৰুটিন') ||
      q.includes('রুটিন') ||
      q.includes('दिनचर्या') ||
      q.includes('thiltum')
    ) {
      if (resources.routines.length > 0) {
        const scheduleStr = resources.routines
          .map(r => `${r.time}: ${r.title}${r.description ? ` (${r.description})` : ''}`)
          .join(', ');

        if (lang === 'as') {
          return `আপোনাৰ দিনচৰ্যা: ${scheduleStr}।`;
        } else if (lang === 'bn') {
          return `আপনার আজকের দিনলিপি: ${scheduleStr}।`;
        } else if (lang === 'ne') {
          return `तपाईंको आजको दिनचर्या: ${scheduleStr}।`;
        } else if (lang === 'mni') {
          return `অদোমগী নোংমগী থবক পরিং: ${scheduleStr}।`;
        } else if (lang === 'kha') {
          return `Ka routine jong phi: ${scheduleStr}.`;
        } else if (lang === 'lus') {
          return `I vawiin thiltum: ${scheduleStr}.`;
        } else if (lang === 'nag') {
          return `Apuni laga routine: ${scheduleStr}.`;
        } else if (lang === 'ny') {
          return `No laga routine: ${scheduleStr}.`;
        } else {
          return `Your schedule today: ${scheduleStr}.`;
        }
      } else {
        if (lang === 'as') {
          return 'আজিৰ বাবে কোনো বিশেষ ৰুটিন তালিকাভুক্ত নাই।';
        } else if (lang === 'bn') {
          return 'আজকের জন্য কোনো নির্ধারিত রুটিন নেই।';
        } else {
          return 'You do not have any routines scheduled for today in your profile.';
        }
      }
    }

    // 5. Reminders Lookup
    if (
      q.includes('reminder') ||
      q.includes('remind') ||
      q.includes('medicine') ||
      q.includes('pill') ||
      q.includes('alarm') ||
      q.includes('সোঁৱৰণী') ||
      q.includes('অনুস্মারক') ||
      q.includes('सम्झना') ||
      q.includes('hriattirna')
    ) {
      if (resources.reminders.length > 0) {
        const reminderStr = resources.reminders
          .map(r => `${r.time}: ${r.title}`)
          .join(', ');

        if (lang === 'as') {
          return `আপোনাৰ সোঁৱৰণীসমূহ: ${reminderStr}।`;
        } else if (lang === 'bn') {
          return `আপনার অনুস্মারকগুলি: ${reminderStr}।`;
        } else {
          return `Your reminders for today: ${reminderStr}.`;
        }
      } else {
        if (lang === 'as') {
          return 'আপোনাৰ এতিয়া কোনো সক্ৰিয় সোঁৱৰণী নাই।';
        } else if (lang === 'bn') {
          return 'আপনার এই মুহূর্তে কোনো অনুস্মারক নেই।';
        } else {
          return 'You have no active reminders right now.';
        }
      }
    }

    // 6. Caregiver / Emergency Contact
    if (
      q.includes('caregiver') ||
      q.includes('emergency') ||
      q.includes('contact') ||
      q.includes('doctor') ||
      q.includes('phone') ||
      q.includes('help') ||
      q.includes('সহায়ক') ||
      q.includes('কেয়ারগিভার') ||
      q.includes('জরুরি') ||
      q.includes('सहायक')
    ) {
      if (resources.caregiverName || resources.emergencyPhone) {
        const cg = resources.caregiverName || 'Your family caregiver';
        const ph = resources.emergencyPhone ? ` Phone: ${resources.emergencyPhone}` : '';

        if (lang === 'as') {
          return `আপোনাৰ মুখ্য সহায়ক হৈছে: ${cg}।${ph}`;
        } else if (lang === 'bn') {
          return `আপনার প্রধান কেয়ারগিভার হলেন: ${cg}।${ph}`;
        } else {
          return `Your primary caregiver is ${cg}.${ph}`;
        }
      }
    }

    // 7. How to add memories / Guidance
    if (q.includes('how to') || q.includes('add') || q.includes('what can i ask') || q.includes('কি জিজ্ঞাসা')) {
      if (lang === 'bn') {
        return 'আপনার কেয়ারগিভার ড্যাশবোর্ড থেকে পরিবার, বাড়ি, এবং প্রতিদিনের রুটিন যুক্ত করতে পারেন। আমি আপনাকে সেগুলি মনে করিয়ে দিতে সাহায্য করব!';
      } else if (lang === 'as') {
        return 'আপোনাৰ সহায়কে কেয়াৰগিভাৰ ডেশ্বব’ৰ্ডৰ পৰা পৰিয়াল আৰু ৰুটিন যোগ কৰিব পাৰে। মই আপোনাক সকলো মনত পেলাই সহায় কৰিম!';
      } else {
        return 'Your caregiver can add your family members, home, and daily routine in the Caregiver Dashboard. Ask me about them anytime!';
      }
    }

    // 8. Dynamic Fallback in active language (No hardcoded Anitha/Green Valley!)
    const pName = resources.patientName && resources.patientName !== 'Patient' ? resources.patientName : '';
    const greeting = pName ? `, ${pName}` : '';

    if (lang === 'as') {
      return `মই এতিয়াও আপোনাৰ প্ৰফাইলত এই তথ্য বিচাৰি পোৱা নাই${greeting}। আপুনি আপোনাৰ পৰিয়াল, ৰুটিন বা খেল খোলিবলৈ ক'ব পাৰে!`;
    } else if (lang === 'bn') {
      return `আমি এখনো আপনার প্রোফাইলে এই তথ্যটি খুঁজে পাইনি${greeting}। আপনি আপনার পরিবার, আজকের রুটিন বা গেম খেলতে বলতে পারেন!`;
    } else if (lang === 'ne') {
      return `मैले तपाईंको प्रोफाइलमा यसबारे जानकारी भेटिनँ${greeting}। तपाईं आफ्नो परिवार, दिनचर्या वा खेलहरू बारे सोध्न सक्नुहुन्छ!`;
    } else if (lang === 'mni') {
      return `আইনা অদোমগী প্রোফাইলদা মসিগী ৱাফম থেংনদ্রি${greeting}। অদোমগী ইমুং নত্রগা শান্নপোৎকী মরমদা হংবীয়ু!`;
    } else if (lang === 'kha') {
      return `Ngam pat ïoh jingtip shaphang kane${greeting}. Kylli shaphang ki baha-ïing lane ki jingïalehkai!`;
    } else if (lang === 'lus') {
      return `Hemi chungchang hi i profile-ah ka la hmu rih lo${greeting}. I chhungte emaw infiamna chungchang zawt rawh!`;
    } else if (lang === 'nag') {
      return `Moi apuni laga profile te eku khobor paanai${greeting}. Apuni laga manu nahoile khel laga kotha kobi!`;
    } else if (lang === 'ny') {
      return `Ngo no laga profile lw khobor paanai${greeting}. No family aw game lw kotha kobi!`;
    } else {
      return `I don't have information about that in your personal memory assistant yet${greeting}. You can ask me about your family, home, daily routines, or tell me to play a cognitive game!`;
    }
  },
};