// server/services/subjects.service.js
import { AppError } from '../lib/errors.js';
import { generateJoinCode } from '../utils/joinCode.js';
import {
  createEnrollment,
  createSubject as createSubjectRepo,
  findEnrollment,
  findSubjectByJoinCode,
  findSubjectById,
  listEnrollmentsBySubject,
  listSubjectsByFaculty,
  listSubjectsByStudent,
  listAllSubjects,
  removeEnrollment,
  updateSubject as updateSubjectRepo,
} from '../repositories/subjects.repository.js';
import { rescheduleTopicsFromStart } from './topics.service.js';

const MAX_JOIN_CODE_RETRIES = 5;

async function generateUniqueJoinCode() {
  for (let i = 0; i < MAX_JOIN_CODE_RETRIES; i++) {
    const code = generateJoinCode();
    const existing = await findSubjectByJoinCode(code);
    if (!existing) return code;
  }
  throw new AppError(500, 'JOIN_CODE_GENERATION_FAILED', 'Unable to generate a unique join code.');
}

export async function createSubject(facultyId, data) {
  const joinCode = await generateUniqueJoinCode();
  const subject = await createSubjectRepo({
    facultyId,
    code: data.code,
    name: data.name,
    description: data.description,
    term: data.term,
    schoolYear: data.schoolYear,
    joinCode,
    passingPercent: data.passingPercent,
    startDate: data.startDate || null,
    meetingDay: data.meetingDay === undefined || data.meetingDay === null ? null : Number(data.meetingDay),
  });
  return subject;
}

export async function getSubject(facultyId, subjectId, isAdmin) {
  const subject = await findSubjectById(subjectId);
  if (!subject) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }
  return subject;
}

export async function updateSubject(facultyId, subjectId, data, isAdmin) {
  const subject = await findSubjectById(subjectId);
  if (!subject) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }

  // Check for duplicate (code, term, schoolYear) if any of those are changing
  const updated = await updateSubjectRepo(subjectId, data);

  // Temporary: when startDate (week 1) changes, reschedule succeeding topic dates automatically
  const nextStart = data.startDate !== undefined ? data.startDate : updated.startDate;
  const nextMeetingDay = data.meetingDay !== undefined ? data.meetingDay : updated.meetingDay;
  const startChanged = data.startDate !== undefined && String(data.startDate || '') !== String(subject.startDate || '');
  const dayChanged = data.meetingDay !== undefined && String(data.meetingDay ?? '') !== String(subject.meetingDay ?? '');
  if (nextStart && (startChanged || dayChanged)) {
    try {
      await rescheduleTopicsFromStart(facultyId, subjectId, String(nextStart).split('T')[0], nextMeetingDay, isAdmin);
    } catch {
      // Non-fatal; subject update still succeeds
    }
  }

  return updated;
}

export async function regenerateJoinCode(facultyId, subjectId, isAdmin) {
  const subject = await findSubjectById(subjectId);
  if (!subject) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }

  const joinCode = await generateUniqueJoinCode();
  const updated = await updateSubjectRepo(subjectId, { joinCode });
  return updated;
}

export async function toggleEnrollment(facultyId, subjectId, open, isAdmin) {
  const subject = await findSubjectById(subjectId);
  if (!subject) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }

  const updated = await updateSubjectRepo(subjectId, { enrollmentOpen: open });
  return updated;
}

export async function archiveSubject(facultyId, subjectId, isAdmin) {
  const subject = await findSubjectById(subjectId);
  if (!subject) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }

  const updated = await updateSubjectRepo(subjectId, { status: 'archived' });
  return updated;
}

export async function enrollStudent(studentId, joinCode) {
  const subject = await findSubjectByJoinCode(joinCode);
  if (!subject) {
    throw new AppError(404, 'JOIN_CODE_INVALID', 'That join code is not valid.');
  }

  if (subject.status !== 'active') {
    throw new AppError(404, 'JOIN_CODE_INVALID', 'That join code is not valid.');
  }

  if (!subject.enrollmentOpen) {
    throw new AppError(403, 'ENROLLMENT_CLOSED', 'Enrollment is closed for this subject.');
  }

  const existing = await findEnrollment(subject.id, studentId);
  if (existing && existing.status === 'active') {
    throw new AppError(409, 'ALREADY_ENROLLED', 'You are already enrolled in this subject.');
  }

  const enrollment = await createEnrollment(subject.id, studentId);
  return { subject, enrollment };
}

export async function listStudentSubjects(studentId) {
  return listSubjectsByStudent(studentId);
}

export async function listFacultySubjects(facultyId, status) {
  return listSubjectsByFaculty(facultyId, status);
}

export async function listAllFacultySubjects(status) {
  return listAllSubjects(status);
}

export async function getRoster(subjectId) {
  return listEnrollmentsBySubject(subjectId);
}

export async function removeStudent(facultyId, subjectId, studentId, isAdmin) {
  const subject = await findSubjectById(subjectId);
  if (!subject) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }
  if (!isAdmin && subject.facultyId !== facultyId) {
    throw new AppError(404, 'NOT_FOUND', 'Subject not found.');
  }

  const enrollment = await findEnrollment(subjectId, studentId);
  if (!enrollment) {
    throw new AppError(404, 'NOT_FOUND', 'Enrollment not found.');
  }

  return removeEnrollment(subjectId, studentId);
}