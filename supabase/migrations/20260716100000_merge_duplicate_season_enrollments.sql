-- Resolve historical duplicate student/season enrollment rows before the
-- import RPC adds a unique index for this relationship.

-- Student 204, season 7: retain the user-selected 2023-05-29 pre-test row.
delete from public.enrollments
where enrollment_id = 'e9201cb9-6d37-4205-b9de-01910cad41f2';

-- Student 245, season 8: retain the populated registration row.
delete from public.enrollments
where enrollment_id = 'a4503697-9e2e-40d3-a229-2c07469a54e4';

-- Student 266, season 11: preserve both courses on the row with the pre-test.
update public.courses
set enrollment_id = 'b710c1bb-499e-4863-8c7f-51873598c0da'
where enrollment_id = '0763217b-8922-4a14-84a7-8ff98423c826';

delete from public.enrollments
where enrollment_id = '0763217b-8922-4a14-84a7-8ff98423c826';

-- Student 36, season 9: the two rows are identical; retain the first row.
delete from public.enrollments
where enrollment_id = 'b7b4ba7e-d496-4f39-aed2-9074e0039282';
