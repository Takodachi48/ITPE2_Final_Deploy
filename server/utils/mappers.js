export function mapProfile(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    firstName: row.first_name,
    lastName: row.last_name,
    studentNumber: row.student_number,
    approvalStatus: row.approval_status,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPresenter(row) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    modules: row.modules || [],
  };
}

export function mapTheme(row) {
  return {
    id: row.id,
    label: row.label,
    range: row.range_label,
    blurb: row.blurb,
    startModule: row.start_module,
    endModule: row.end_module,
    sortOrder: row.sort_order,
    moduleIds: row.module_ids || [],
  };
}

export function mapModule(row) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    summary: row.summary,
    pptUrl: row.ppt_url,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    theme: {
      id: row.theme_id,
      label: row.theme_label,
      range: row.theme_range,
      blurb: row.theme_blurb,
    },
    videos: row.videos || [],
    presenters: row.presenters || [],
  };
}

export function mapSubject(row) {
  if (!row) return null;
  return {
    id: row.id,
    facultyId: row.faculty_id,
    code: row.code,
    name: row.name,
    description: row.description,
    term: row.term,
    schoolYear: row.school_year,
    joinCode: row.join_code,
    passingPercent: row.passing_percent,
    enrollmentOpen: row.enrollment_open,
    status: row.status,
    timezone: row.timezone,
    startDate: row.start_date,
    meetingDay: row.meeting_day,
    studentCount: row.student_count != null ? Number(row.student_count) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTopic(row) {
  if (!row) return null;
  return {
    id: row.id,
    subjectId: row.subject_id,
    position: row.position,
    title: row.title,
    description: row.description,
    availableFrom: row.available_from,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapContentBlock(row) {
  if (!row) return null;
  return {
    id: row.id,
    topicId: row.topic_id,
    type: row.type,
    title: row.title,
    body: row.body,
    url: row.url,
    filePath: row.file_path,
    fileName: row.file_name,
    fileMime: row.file_mime,
    fileSize: row.file_size,
    visibleToStudents: row.visible_to_students,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapEnrollment(row) {
  if (!row) return null;
  return {
    id: row.id,
    subjectId: row.subject_id,
    studentId: row.student_id,
    status: row.status,
    enrolledAt: row.enrolled_at,
    removedAt: row.removed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
export function mapQuiz(row) {
  if (!row) return null;
  return {
    id: row.id,
    topicId: row.topic_id,
    title: row.title,
    mode: row.mode,
    instructions: row.instructions,
    totalItems: row.total_items,
    externalUrl: row.external_url,
    attachmentPath: row.attachment_path,
    attachmentName: row.attachment_name,
    attachmentMime: row.attachment_mime,
    maxAttempts: row.max_attempts,
    showAnswers: row.show_answers,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapQuestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    quizId: row.quiz_id,
    position: row.position,
    type: row.type,
    prompt: row.prompt,
    options: row.options,
    correctOptionId: row.correct_option_id,
    acceptedAnswers: row.accepted_answers,
    points: row.points,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAttempt(row) {
  if (!row) return null;
  return {
    id: row.id,
    quizId: row.quiz_id,
    studentId: row.student_id,
    attemptNo: row.attempt_no,
    source: row.source,
    status: row.status,
    answers: row.answers,
    score: row.score,
    total: row.total,
    imagePath: row.image_path,
    feedback: row.feedback,
    gradedBy: row.graded_by,
    gradedAt: row.graded_at,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
