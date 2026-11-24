-- EGS — Application: add Royal Villas (RV)
-- Royal Villas are villas, not apartments: the code is just RV-<number> (no building / floor / unit).
-- Adds every villa to the Application list (application_checks). Send Task reads its villas from here too.
-- Safe to run twice: villas already there are left as they are. Car Park is NOT changed.

insert into public.application_checks (id, project, property_id)
select 'RV|' || v, 'RV', v
from unnest(array[
  'RV-1', 'RV-2', 'RV-3', 'RV-4', 'RV-5', 'RV-6', 'RV-7', 'RV-8', 'RV-9', 'RV-10', 'RV-11', 'RV-12', 'RV-13',
  'RV-14', 'RV-15', 'RV-16', 'RV-17', 'RV-18', 'RV-19', 'RV-20', 'RV-21', 'RV-22', 'RV-23', 'RV-24', 'RV-25',
  'RV-26', 'RV-27', 'RV-28', 'RV-29', 'RV-30', 'RV-31', 'RV-32', 'RV-33', 'RV-34', 'RV-35', 'RV-36', 'RV-37',
  'RV-38', 'RV-39', 'RV-40', 'RV-41', 'RV-42', 'RV-43', 'RV-44', 'RV-45', 'RV-46', 'RV-47', 'RV-48', 'RV-49',
  'RV-50', 'RV-51', 'RV-52', 'RV-53', 'RV-54', 'RV-55', 'RV-56', 'RV-57', 'RV-58', 'RV-59', 'RV-60', 'RV-61',
  'RV-62', 'RV-63', 'RV-64', 'RV-65', 'RV-66', 'RV-67', 'RV-68', 'RV-69', 'RV-70', 'RV-71', 'RV-71A', 'RV-72',
  'RV-72A', 'RV-73', 'RV-74', 'RV-75', 'RV-76', 'RV-77', 'RV-78', 'RV-79', 'RV-80', 'RV-81', 'RV-82', 'RV-83',
  'RV-84', 'RV-85', 'RV-86', 'RV-87', 'RV-88', 'RV-89', 'RV-90', 'RV-91', 'RV-92', 'RV-93', 'RV-94', 'RV-95',
  'RV-96', 'RV-97', 'RV-98', 'RV-99', 'RV-100', 'RV-101', 'RV-102', 'RV-103', 'RV-104', 'RV-105', 'RV-106',
  'RV-107', 'RV-108', 'RV-109', 'RV-110', 'RV-111', 'RV-112', 'RV-113', 'RV-114', 'RV-115', 'RV-116', 'RV-117',
  'RV-119', 'RV-120', 'RV-121', 'RV-122', 'RV-123', 'RV-124', 'RV-125', 'RV-126', 'RV-127', 'RV-128', 'RV-129',
  'RV-130', 'RV-131', 'RV-132', 'RV-133', 'RV-134', 'RV-135', 'RV-136', 'RV-137', 'RV-138', 'RV-139', 'RV-140',
  'RV-141', 'RV-142', 'RV-143', 'RV-144', 'RV-145', 'RV-146', 'RV-147', 'RV-148', 'RV-149', 'RV-150', 'RV-151',
  'RV-152', 'RV-153', 'RV-154', 'RV-155', 'RV-156', 'RV-157', 'RV-158', 'RV-159', 'RV-160', 'RV-161', 'RV-162',
  'RV-163', 'RV-164', 'RV-165', 'RV-166', 'RV-167', 'RV-168', 'RV-169', 'RV-170', 'RV-171', 'RV-172', 'RV-173',
  'RV-174', 'RV-175', 'RV-176', 'RV-177', 'RV-178', 'RV-179', 'RV-180', 'RV-181', 'RV-182', 'RV-183', 'RV-184',
  'RV-185', 'RV-186', 'RV-187', 'RV-188', 'RV-189', 'RV-189A', 'RV-190', 'RV-190A', 'RV-191', 'RV-192',
  'RV-193', 'RV-194', 'RV-196', 'RV-197', 'RV-198', 'RV-199', 'RV-200', 'RV-201', 'RV-202', 'RV-203', 'RV-204',
  'RV-205', 'RV-206', 'RV-207', 'RV-208', 'RV-209', 'RV-210', 'RV-211', 'RV-212', 'RV-213', 'RV-214', 'RV-215',
  'RV-216', 'RV-217', 'RV-217A', 'RV-218', 'RV-218A', 'RV-219', 'RV-220', 'RV-221', 'RV-222', 'RV-223',
  'RV-224', 'RV-225', 'RV-226', 'RV-227', 'RV-228', 'RV-229', 'RV-230', 'RV-231', 'RV-232', 'RV-233', 'RV-234',
  'RV-235', 'RV-236', 'RV-237', 'RV-238', 'RV-239', 'RV-240', 'RV-241', 'RV-243', 'RV-244', 'RV-245', 'RV-246',
  'RV-247', 'RV-248', 'RV-249', 'RV-250', 'RV-251', 'RV-252', 'RV-253', 'RV-254', 'RV-255', 'RV-256', 'RV-258',
  'RV-259', 'RV-260', 'RV-261', 'RV-262', 'RV-263', 'RV-264', 'RV-265', 'RV-266', 'RV-267', 'RV-268', 'RV-269',
  'RV-270', 'RV-271', 'RV-272', 'RV-273', 'RV-274', 'RV-275', 'RV-276', 'RV-277', 'RV-278', 'RV-279', 'RV-280',
  'RV-281', 'RV-282', 'RV-283', 'RV-284', 'RV-285', 'RV-286', 'RV-287', 'RV-288', 'RV-289', 'RV-290', 'RV-291',
  'RV-292', 'RV-293', 'RV-294', 'RV-295', 'RV-296', 'RV-297', 'RV-298', 'RV-299'
]) as v
on conflict (id) do nothing;

-- Check: should say 301 (the list has RV-71A, 72A, 189A, 190A, 217A, 218A and no RV-118, 195, 242, 257)
select count(*) as royal_villas from public.application_checks where project = 'RV';
