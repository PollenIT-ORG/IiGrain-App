-- ===========================================================================
-- The KAB field monitoring worksheet as an input based assessment template:
-- each category is one form a farmer fills in, and its questions are the
-- fields of that form. Ready to use, copy or set as Global from the panel.
-- Ids are fixed, so running this twice adds nothing.
-- ===========================================================================

DO $$
DECLARE
  template_id CONSTANT uuid := '7543c799-6e90-48b6-895f-312265626b7a';
BEGIN
  IF EXISTS (SELECT 1 FROM assessment_templates WHERE id = template_id) THEN
    RETURN;
  END IF;

  INSERT INTO assessment_templates (id, owner_id, is_global, name, description, question_kind)
  VALUES (template_id, NULL, false, 'KAB Field Monitoring',
          'Field monitoring worksheet from KAB: nine forms covering the farm profile, trainings, soil samples and the practices a field is scored on.',
          'input');

  INSERT INTO assessment_categories (id, template_id, name, sort_order, is_active)
  VALUES ('f035bde7-fc1a-4d1c-8c2f-ddf8e455cca3', template_id, 'Farm profile', 0, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('ad7773d2-8c18-46d0-8b81-ed20dab3e0c1', 'f035bde7-fc1a-4d1c-8c2f-ddf8e455cca3', 'fp1', 'Field size (acres)', 'number', 3, 'optional', 'optional', 'From the farm profile sheet.', 0, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('e7b1f6f0-784e-4b7e-8a99-5c9a754dd3fa', 'f035bde7-fc1a-4d1c-8c2f-ddf8e455cca3', 'fp2', 'Tillage practice on this field', 'mcq', 3, 'optional', 'optional', NULL, 1, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('862365f6-2a65-4880-899e-7f5d39e5ba36', 'e7b1f6f0-784e-4b7e-8a99-5c9a754dd3fa', 'No Till', 3, 0, true),
         ('a5fae943-7949-4115-83b3-b98b443c4ad7', 'e7b1f6f0-784e-4b7e-8a99-5c9a754dd3fa', 'Reduced Till', 2, 1, true),
         ('ab3e1f70-836e-4a73-808d-10e3063f5ac0', 'e7b1f6f0-784e-4b7e-8a99-5c9a754dd3fa', 'Did not meet the requirement', 0, 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('863c9bfb-fc3e-4133-8d56-b49b222326d7', 'f035bde7-fc1a-4d1c-8c2f-ddf8e455cca3', 'fp3', 'Organic amendment used', 'mcq', 3, 'optional', 'optional', NULL, 2, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('6eb3a6ac-3b0a-4102-832b-20e636a227bc', '863c9bfb-fc3e-4133-8d56-b49b222326d7', 'Yes', 3, 0, true),
         ('977b3e86-3139-4eb6-8ed4-ebed666cf513', '863c9bfb-fc3e-4133-8d56-b49b222326d7', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('f0c601b7-6666-43d6-8743-56540fe4776b', 'f035bde7-fc1a-4d1c-8c2f-ddf8e455cca3', 'fp4', 'Crop intensification practised', 'mcq', 3, 'optional', 'optional', NULL, 3, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('c32560fe-1f21-474a-88f5-c0b98a10c5ea', 'f0c601b7-6666-43d6-8743-56540fe4776b', 'Yes', 3, 0, true),
         ('f860c4ce-1865-4413-84ea-57d9bf7cf8a0', 'f0c601b7-6666-43d6-8743-56540fe4776b', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('7c27b31b-ddbe-438c-8a34-7e96d73b9b3f', 'f035bde7-fc1a-4d1c-8c2f-ddf8e455cca3', 'fp5', 'Crop diversification practised', 'mcq', 3, 'optional', 'optional', NULL, 4, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('e7b6801b-d786-45ff-8d78-69adf66b8256', '7c27b31b-ddbe-438c-8a34-7e96d73b9b3f', 'Yes', 3, 0, true),
         ('e5577daf-4991-4fa2-8d32-17dee48a6310', '7c27b31b-ddbe-438c-8a34-7e96d73b9b3f', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('ad59b929-8cfa-4915-8771-217be9a64b12', 'f035bde7-fc1a-4d1c-8c2f-ddf8e455cca3', 'fp6', 'Synthetic nutrient management practised', 'mcq', 3, 'optional', 'optional', NULL, 5, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('9ee848ee-ee7c-45a9-8a03-21e4c1e2b477', 'ad59b929-8cfa-4915-8771-217be9a64b12', 'Yes', 3, 0, true),
         ('2ceb29b7-2fe5-4bd3-8fcc-f411b32259e7', 'ad59b929-8cfa-4915-8771-217be9a64b12', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('4f46b6b6-c00c-4c5f-891f-2fdf2525a680', 'f035bde7-fc1a-4d1c-8c2f-ddf8e455cca3', 'fp7', 'Animal integration practised', 'mcq', 3, 'optional', 'optional', NULL, 6, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('b24825ec-41df-4c30-8e52-93a373eeeef6', '4f46b6b6-c00c-4c5f-891f-2fdf2525a680', 'Yes', 3, 0, true),
         ('e3ec0c1a-1900-432b-8f3c-bbfb819f3e58', '4f46b6b6-c00c-4c5f-891f-2fdf2525a680', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('c0f8df3e-ac30-4ae9-80f3-b507822eea70', 'f035bde7-fc1a-4d1c-8c2f-ddf8e455cca3', 'fp8', 'Scorecard tier', 'mcq', 3, 'optional', 'optional', 'The tier this field is assessed against.', 7, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('e9002111-ad64-4eac-8819-97cf76074e6c', 'c0f8df3e-ac30-4ae9-80f3-b507822eea70', 'Silver', 3, 0, true),
         ('62ef7f52-5e9a-4c4f-8ca7-d0dd70635489', 'c0f8df3e-ac30-4ae9-80f3-b507822eea70', 'Bronze', 2, 1, true);

  INSERT INTO assessment_categories (id, template_id, name, sort_order, is_active)
  VALUES ('e1211027-d966-43d0-87a6-448bad17b469', template_id, 'Trainings', 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('acc71e61-faf5-46ad-80a4-465ce8d10bb7', 'e1211027-d966-43d0-87a6-448bad17b469', 'tr1', 'Date of the training', 'date', 3, 'optional', 'optional', NULL, 0, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('3f0ca7d8-47bf-4a5a-873e-b7245f97a581', 'e1211027-d966-43d0-87a6-448bad17b469', 'tr2', 'Name of the training', 'text', 3, 'optional', 'optional', NULL, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('b8394f2e-e3bd-46d2-82d3-92e322862ab0', 'e1211027-d966-43d0-87a6-448bad17b469', 'tr3', 'Training organizer, host or sponsor', 'text', 3, 'optional', 'optional', NULL, 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('888bdbb2-b8ff-42e7-8170-f051a7bd349f', 'e1211027-d966-43d0-87a6-448bad17b469', 'tr4', 'Topics covered', 'long_text', 3, 'optional', 'optional', NULL, 3, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('8be55b2a-57b3-41f3-89d1-d03996c89cb9', 'e1211027-d966-43d0-87a6-448bad17b469', 'tr5', 'Length of the training (hours)', 'number', 3, 'optional', 'optional', NULL, 4, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('bb385c8c-81a5-4474-8641-aed4d01c6a32', 'e1211027-d966-43d0-87a6-448bad17b469', 'tr6', 'Photo of the training record', 'text', 3, 'required', 'optional', 'Attendance sheet or certificate, if there is one.', 5, true);

  INSERT INTO assessment_categories (id, template_id, name, sort_order, is_active)
  VALUES ('4984b3cf-29eb-432e-84ab-99bb01486fa3', template_id, 'Soil sample results', 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('6a7656a2-ee04-447a-89c8-99afcb2c26f3', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss1', 'Dominant soil type (NRCS soil series and texture)', 'text', 3, 'optional', 'optional', NULL, 0, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('f6ec6c12-a927-4c25-8f26-a3ffaa2a5078', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss2', 'Soil sample date', 'date', 3, 'optional', 'optional', NULL, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('3fb009bf-ee7e-4245-89fd-e67f9d3691c8', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss3', 'Photo of the lab report', 'text', 3, 'required', 'optional', NULL, 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('5ff74dfb-7533-4ed0-8a17-ebe8b68aa00c', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss1a', 'GPS point 1: longitude', 'text', 3, 'optional', 'optional', NULL, 3, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('f4c508b3-25c6-41d9-8837-8274a8f7c4b3', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss1b', 'GPS point 1: latitude', 'text', 3, 'optional', 'optional', NULL, 4, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('1469146c-141f-49d0-866e-cd26d024fc8d', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss1c', 'GPS point 1: SOC 0 to 2', 'number', 3, 'optional', 'optional', NULL, 5, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('1804beee-8242-4190-8ae8-a7969072bb71', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss1d', 'GPS point 1: SOC 2 to 6', 'number', 3, 'optional', 'optional', NULL, 6, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('b316b432-6d83-4656-838c-692e70268bbe', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss1e', 'GPS point 1: WAS 0 to 2', 'number', 3, 'optional', 'optional', NULL, 7, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('f167bdba-5015-4930-87d7-8d8f28b8d764', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss2a', 'GPS point 2: longitude', 'text', 3, 'optional', 'optional', NULL, 8, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('61ddec4c-8830-47f1-8c64-640e9acdb781', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss2b', 'GPS point 2: latitude', 'text', 3, 'optional', 'optional', NULL, 9, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('c75d6f26-eab3-431c-8464-38a882034493', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss2c', 'GPS point 2: SOC 0 to 2', 'number', 3, 'optional', 'optional', NULL, 10, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('ea9e6793-dcd8-41ba-813a-333a15a26155', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss2d', 'GPS point 2: SOC 2 to 6', 'number', 3, 'optional', 'optional', NULL, 11, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('71192a44-7038-454c-861e-2e1d9ef99653', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss2e', 'GPS point 2: WAS 0 to 2', 'number', 3, 'optional', 'optional', NULL, 12, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('93d20834-4df8-425a-86f3-f9a2b6b875dd', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss3a', 'GPS point 3: longitude', 'text', 3, 'optional', 'optional', NULL, 13, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('9ab43995-2e4f-4113-81cb-4405a3b0b565', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss3b', 'GPS point 3: latitude', 'text', 3, 'optional', 'optional', NULL, 14, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('33ad9f60-34d2-430e-87e0-d4cf773596b5', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss3c', 'GPS point 3: SOC 0 to 2', 'number', 3, 'optional', 'optional', NULL, 15, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('0902df48-d55e-478d-8997-d4203c40a82a', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss3d', 'GPS point 3: SOC 2 to 6', 'number', 3, 'optional', 'optional', NULL, 16, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('1581b73a-a849-49c8-8076-4603d287a821', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss3e', 'GPS point 3: WAS 0 to 2', 'number', 3, 'optional', 'optional', NULL, 17, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('4f824b40-5667-4103-8b7a-3893b5dab7fc', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss4a', 'GPS point 4: longitude', 'text', 3, 'optional', 'optional', NULL, 18, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('081d6922-5877-4a86-80b1-64181dd56841', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss4b', 'GPS point 4: latitude', 'text', 3, 'optional', 'optional', NULL, 19, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('27a415bd-cc03-43cf-8669-e14120c5154f', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss4c', 'GPS point 4: SOC 0 to 2', 'number', 3, 'optional', 'optional', NULL, 20, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('786d67a2-6c30-48f7-8947-f770baea672b', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss4d', 'GPS point 4: SOC 2 to 6', 'number', 3, 'optional', 'optional', NULL, 21, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('95c554d8-4b37-4b27-8e29-e88b09aaacaa', '4984b3cf-29eb-432e-84ab-99bb01486fa3', 'ss4e', 'GPS point 4: WAS 0 to 2', 'number', 3, 'optional', 'optional', NULL, 22, true);

  INSERT INTO assessment_categories (id, template_id, name, sort_order, is_active)
  VALUES ('1b08bada-a1d5-4752-860f-f414734cda2c', template_id, 'Irrigation, pesticide and fertiliser', 3, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('4ccd2c08-9288-43bf-860b-69b49890d3c7', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip1', 'Crop type', 'mcq', 3, 'optional', 'optional', NULL, 0, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('9ec0141e-6abb-4e69-8b24-5de62235a18f', '4ccd2c08-9288-43bf-860b-69b49890d3c7', 'Cash', 1, 0, true),
         ('9593d080-b2a6-4a95-84ef-72475f0f7cdb', '4ccd2c08-9288-43bf-860b-69b49890d3c7', 'Cover', 3, 1, true),
         ('3b9c018b-fabc-407a-8fe5-7a3b2665d72f', '4ccd2c08-9288-43bf-860b-69b49890d3c7', 'Forage', 2, 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('948b761c-ec65-4790-8ade-99bd30277cff', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip2', 'Crop species', 'text', 3, 'optional', 'optional', NULL, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('456ce92c-15e7-431a-85b2-0f0600f50bc5', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip3', 'Plant date', 'date', 3, 'optional', 'optional', NULL, 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('08b0c764-1113-49ba-8a89-a782881075be', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip4', 'Harvest date', 'date', 3, 'optional', 'optional', NULL, 3, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('2adaac91-42d1-475e-872d-00f2d823a2a7', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip5', 'Yield', 'number', 3, 'optional', 'optional', NULL, 4, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('c1cd651f-a4cc-4fe3-8e77-2621fcb297de', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip6', 'Yield unit', 'text', 3, 'optional', 'optional', 'For example bu/acre.', 5, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('966b981e-73d4-47b9-8122-b14560f33e13', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip7', 'Field is irrigated', 'boolean', 3, 'optional', 'optional', NULL, 6, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('cf7fc63c-2f69-4d5b-8433-c3c5b1ebb023', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip8', 'Date of the first irrigation event of the year', 'date', 3, 'optional', 'optional', NULL, 7, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('08c20156-02a0-4734-865c-eecd0661f903', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip9', 'Irrigation amount used in the calendar year (inches)', 'number', 3, 'optional', 'optional', NULL, 8, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('f8af5657-5fa9-40b1-8c41-5f90840d139b', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip10', 'Irrigation type', 'text', 3, 'optional', 'optional', 'For example centre pivot.', 9, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('f36b0626-4218-4614-8829-9eeb2cb51a52', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip11', 'Date of the last irrigation event of the year', 'date', 3, 'optional', 'optional', NULL, 10, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('914fd8c9-58ba-45c6-8fb3-10b291aceb8a', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip12', 'Pesticide application date', 'date', 3, 'optional', 'optional', NULL, 11, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('c3c30496-257e-42e4-8b55-7fa7da02784d', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip13', 'Pesticide used', 'text', 3, 'optional', 'optional', NULL, 12, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('0dc56983-02a7-4f2a-8ace-5697e10e6c90', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip14', 'Pesticide rate', 'number', 3, 'optional', 'optional', NULL, 13, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('e9fae67b-bc90-4cce-8df4-870ce336b0e6', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip15', 'Pesticide rate unit', 'text', 3, 'optional', 'optional', NULL, 14, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('705f7902-1cdd-45bf-8aba-4d81559b2456', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip16', 'Pesticide application method', 'text', 3, 'optional', 'optional', NULL, 15, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('44f754ef-22a1-447f-82d4-609dfe51b6db', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip17', 'Synthetic fertiliser bulk lbs per acre', 'number', 3, 'optional', 'optional', NULL, 16, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('f2627656-5356-41cd-8b10-ea238397d6eb', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip18', 'Fertiliser N%', 'number', 3, 'optional', 'optional', NULL, 17, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('a7120a41-1f8e-47b3-86ea-01368477ba4e', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip19', 'Fertiliser P%', 'number', 3, 'optional', 'optional', NULL, 18, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('20431154-9c91-4981-843b-3f699358186b', '1b08bada-a1d5-4752-860f-f414734cda2c', 'ip20', 'Fertiliser K%', 'number', 3, 'optional', 'optional', NULL, 19, true);

  INSERT INTO assessment_categories (id, template_id, name, sort_order, is_active)
  VALUES ('d25cb524-de52-4405-8f50-38843da2d0d1', template_id, 'Tillage', 4, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('6c8152a3-74fa-44e1-896b-fd820c247869', 'd25cb524-de52-4405-8f50-38843da2d0d1', 'ti1', 'Tillage carried out on this field', 'boolean', 3, 'optional', 'optional', NULL, 0, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('1279a023-c3e5-4514-8f58-cd5bfdf64560', 'd25cb524-de52-4405-8f50-38843da2d0d1', 'ti2', 'Date of tillage', 'date', 3, 'optional', 'optional', NULL, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('ae7b14cc-bbf2-4601-8acf-3e81e9d96e3c', 'd25cb524-de52-4405-8f50-38843da2d0d1', 'ti3', 'Tillage implement used', 'text', 3, 'optional', 'optional', NULL, 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('bbff877d-c9ea-4bff-83a9-c293aaa2f4c0', 'd25cb524-de52-4405-8f50-38843da2d0d1', 'ti4', 'Tillage depth', 'text', 3, 'optional', 'optional', NULL, 3, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('e3b2d1dc-de54-42e7-8823-4330c23ede55', 'd25cb524-de52-4405-8f50-38843da2d0d1', 'ti5', 'Crop residue after the tillage event (%)', 'number', 3, 'optional', 'optional', 'Not to be less than 40%.', 4, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('5b68bcd6-34cc-4dd3-859b-d8274136326d', 'd25cb524-de52-4405-8f50-38843da2d0d1', 'ti6', 'Crop residue before planting (%)', 'number', 3, 'optional', 'optional', 'Not to be less than 40%.', 5, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('10c093e7-9a88-4023-81cc-32a51a9a663b', 'd25cb524-de52-4405-8f50-38843da2d0d1', 'ti7', 'Photo of the field after tillage', 'text', 3, 'required', 'optional', NULL, 6, true);

  INSERT INTO assessment_categories (id, template_id, name, sort_order, is_active)
  VALUES ('49b1fe85-0c1f-41d1-87c1-7186c0b81761', template_id, 'Organic amendments', 5, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('264c535c-225b-4afd-8217-6ffd66c98db7', '49b1fe85-0c1f-41d1-87c1-7186c0b81761', 'oa1', 'Practice is in use', 'mcq', 3, 'optional', 'optional', NULL, 0, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('a1672057-94d2-4c5e-8781-b1e4e1600f3d', '264c535c-225b-4afd-8217-6ffd66c98db7', 'Yes', 3, 0, true),
         ('f0c3dbd8-58ac-40dd-8bd0-0486d3cce9b2', '264c535c-225b-4afd-8217-6ffd66c98db7', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('4f93b459-7fec-4453-8291-5297565f691c', '49b1fe85-0c1f-41d1-87c1-7186c0b81761', 'oa2', 'Amendment type', 'text', 3, 'optional', 'optional', 'For example manure or compost.', 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('0c378763-d3d2-4d80-818a-6d7233b30a01', '49b1fe85-0c1f-41d1-87c1-7186c0b81761', 'oa3', 'Amendment N%', 'number', 3, 'optional', 'optional', NULL, 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('de842d24-b799-43ee-8fec-c846e6d66bd1', '49b1fe85-0c1f-41d1-87c1-7186c0b81761', 'oa4', 'Amendment P%', 'number', 3, 'optional', 'optional', NULL, 3, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('1266b896-ffd4-43eb-846e-8b0eacfa7226', '49b1fe85-0c1f-41d1-87c1-7186c0b81761', 'oa5', 'Amendment K%', 'number', 3, 'optional', 'optional', NULL, 4, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('ccdbebe2-f96f-41f4-8695-a3ee388546a5', '49b1fe85-0c1f-41d1-87c1-7186c0b81761', 'oa6', 'Bulk rate per acre', 'text', 3, 'optional', 'optional', 'For example 10 ton / acre.', 5, true);

  INSERT INTO assessment_categories (id, template_id, name, sort_order, is_active)
  VALUES ('56a327f4-20df-45ab-87ac-09d2d5592964', template_id, 'Crop diversification and intensification', 6, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('075da8dd-dbac-4b6a-87e3-22c2403470bb', '56a327f4-20df-45ab-87ac-09d2d5592964', 'cd1', 'Crop diversification is in use', 'mcq', 3, 'optional', 'optional', NULL, 0, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('a91dac58-f730-443d-83b3-29bcec89bbcb', '075da8dd-dbac-4b6a-87e3-22c2403470bb', 'Yes', 3, 0, true),
         ('95968d82-9116-4f6a-89f3-31967bc5eb12', '075da8dd-dbac-4b6a-87e3-22c2403470bb', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('bf157490-e982-4a35-8664-d0715aa3a7ae', '56a327f4-20df-45ab-87ac-09d2d5592964', 'cd2', 'Crop intensification is in use', 'mcq', 3, 'optional', 'optional', NULL, 1, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('a4996d7e-2035-4ebb-8679-fe30e6efcca3', 'bf157490-e982-4a35-8664-d0715aa3a7ae', 'Yes', 3, 0, true),
         ('bd1d14df-c4a3-4220-83bc-0dd11cdcd2f8', 'bf157490-e982-4a35-8664-d0715aa3a7ae', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('920cc766-2df7-4857-8228-d9c7e0ce14ea', '56a327f4-20df-45ab-87ac-09d2d5592964', 'cd3', 'Cropping intensity zone', 'mcq', 3, 'optional', 'optional', 'From the crop intensification resource.', 2, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('75dfc9de-29cc-48e1-8932-548a0502d98a', '920cc766-2df7-4857-8228-d9c7e0ce14ea', 'Zone 1', 3, 0, true),
         ('c4af9edc-117a-4a87-82d1-da4e94c6a608', '920cc766-2df7-4857-8228-d9c7e0ce14ea', 'Zone 2', 2, 1, true),
         ('d42355fe-eda2-4ae2-8948-574949f63da8', '920cc766-2df7-4857-8228-d9c7e0ce14ea', 'Zone 3', 1, 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('1a6075c7-fb8e-429f-8dfd-424697c25e75', '56a327f4-20df-45ab-87ac-09d2d5592964', 'cd4', 'Crop type', 'mcq', 3, 'optional', 'optional', NULL, 3, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('be9a2f44-c117-473e-8fdc-7e3033e82e76', '1a6075c7-fb8e-429f-8dfd-424697c25e75', 'Cash', 1, 0, true),
         ('eafbad15-b6ba-4f3f-83d1-ce6aa8990ea9', '1a6075c7-fb8e-429f-8dfd-424697c25e75', 'Cover', 3, 1, true),
         ('22449fa7-2ed3-45b1-89cc-a29555c54027', '1a6075c7-fb8e-429f-8dfd-424697c25e75', 'Forage', 2, 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('23995c6c-b0b6-4466-8ee9-58584ea9eaec', '56a327f4-20df-45ab-87ac-09d2d5592964', 'cd5', 'Crop species', 'text', 3, 'optional', 'optional', NULL, 4, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('28f87ce5-9a76-4ab3-8b02-435f4eb18324', '56a327f4-20df-45ab-87ac-09d2d5592964', 'cd6', 'Plant date', 'date', 3, 'optional', 'optional', NULL, 5, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('82f64d33-7323-4b20-82a2-b76ebb6ed5de', '56a327f4-20df-45ab-87ac-09d2d5592964', 'cd7', 'Harvest date', 'date', 3, 'optional', 'optional', NULL, 6, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('45788dc0-628e-42fd-84df-368636c47fa2', '56a327f4-20df-45ab-87ac-09d2d5592964', 'cd8', 'Yield, if the crop is harvested', 'number', 3, 'optional', 'optional', NULL, 7, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('3feee59a-89af-44b2-83d7-6f2f2ed7b753', '56a327f4-20df-45ab-87ac-09d2d5592964', 'cd9', 'Yield unit', 'text', 3, 'optional', 'optional', NULL, 8, true);

  INSERT INTO assessment_categories (id, template_id, name, sort_order, is_active)
  VALUES ('a9369373-190b-4002-8388-98c002422709', template_id, 'Nutrient management', 7, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('4f3d1573-74bd-4ade-8ead-c760047ee0ae', 'a9369373-190b-4002-8388-98c002422709', 'nm1', 'Practice is in use', 'mcq', 3, 'optional', 'optional', NULL, 0, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('2106f8b4-dbe8-47b7-8ca6-5706dc90f944', '4f3d1573-74bd-4ade-8ead-c760047ee0ae', 'Yes', 3, 0, true),
         ('e78a4873-accf-4037-875e-8111ac64e89a', '4f3d1573-74bd-4ade-8ead-c760047ee0ae', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('03f4dd84-b6cf-4f36-83ad-b3a632cbef85', 'a9369373-190b-4002-8388-98c002422709', 'nm2', 'Date of the fertility event', 'date', 3, 'optional', 'optional', NULL, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('9975f64d-5cdf-4374-89ae-1fbf7d8d6117', 'a9369373-190b-4002-8388-98c002422709', 'nm3', 'Variable rate technology used', 'mcq', 3, 'optional', 'optional', NULL, 2, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('448c244c-43ae-4d58-8017-10a7e51a014c', '9975f64d-5cdf-4374-89ae-1fbf7d8d6117', 'Yes', 3, 0, true),
         ('5bb56691-28f7-43b7-840e-f31a22c901f4', '9975f64d-5cdf-4374-89ae-1fbf7d8d6117', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('c068fbb7-1d39-4607-848d-011dcaae6dca', 'a9369373-190b-4002-8388-98c002422709', 'nm4', 'Split rate application used', 'mcq', 3, 'optional', 'optional', NULL, 3, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('c1280aef-7012-4697-8d5e-2be7504da732', 'c068fbb7-1d39-4607-848d-011dcaae6dca', 'Yes', 3, 0, true),
         ('181feb78-5e6b-446c-870f-2b41ed82f029', 'c068fbb7-1d39-4607-848d-011dcaae6dca', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('ac5936cb-a378-4417-8394-597efc829ba5', 'a9369373-190b-4002-8388-98c002422709', 'nm5', 'Enhanced efficiency fertiliser used', 'mcq', 3, 'optional', 'optional', NULL, 4, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('66f2eed1-8fa8-453a-8f44-fbbd8e7d9138', 'ac5936cb-a378-4417-8394-597efc829ba5', 'Yes', 3, 0, true),
         ('cb2f3f18-2460-4435-89c4-d2e49174bbf9', 'ac5936cb-a378-4417-8394-597efc829ba5', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('451f8436-e00f-4f9a-8589-b20a51d205d7', 'a9369373-190b-4002-8388-98c002422709', 'nm6', 'Application method', 'text', 3, 'optional', 'optional', 'For example spray rig.', 5, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('497a3bcc-3c31-4dfe-8583-df1a1e3105ec', 'a9369373-190b-4002-8388-98c002422709', 'nm7', 'Fertiliser N%', 'number', 3, 'optional', 'optional', NULL, 6, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('28a2d5b5-265e-4e18-8e47-2ccea7888368', 'a9369373-190b-4002-8388-98c002422709', 'nm8', 'Fertiliser P%', 'number', 3, 'optional', 'optional', NULL, 7, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('ec8f8dc2-fdfd-44ce-86ff-38bd7b16d53e', 'a9369373-190b-4002-8388-98c002422709', 'nm9', 'Fertiliser K%', 'number', 3, 'optional', 'optional', NULL, 8, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('b6ee3326-d084-40da-82de-16a822df316a', 'a9369373-190b-4002-8388-98c002422709', 'nm10', 'Bulk lbs per acre', 'number', 3, 'optional', 'optional', NULL, 9, true);

  INSERT INTO assessment_categories (id, template_id, name, sort_order, is_active)
  VALUES ('28004cc6-bd3c-4c62-8187-0554dafc711d', template_id, 'Animal integration', 8, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('0ef63c16-24fe-4dd6-8061-4dad355523e1', '28004cc6-bd3c-4c62-8187-0554dafc711d', 'ai1', 'Practice is in use', 'mcq', 3, 'optional', 'optional', NULL, 0, true);
  INSERT INTO assessment_question_options (id, question_id, option_text, score, sort_order, is_active)
  VALUES ('cc4fbbab-ec6f-495b-8243-c9d1e6f16e3d', '0ef63c16-24fe-4dd6-8061-4dad355523e1', 'Yes', 3, 0, true),
         ('5a62f14f-2d0d-4190-83dd-8c213e291b21', '0ef63c16-24fe-4dd6-8061-4dad355523e1', 'No', 0, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('46629175-90ea-4a5a-8356-b0a29a0b3f2d', '28004cc6-bd3c-4c62-8187-0554dafc711d', 'ai2', 'Animal breed', 'text', 3, 'optional', 'optional', NULL, 1, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('c594a6a4-1a41-4ccc-8305-cc3adf132b5c', '28004cc6-bd3c-4c62-8187-0554dafc711d', 'ai3', 'Grazing period', 'text', 3, 'optional', 'optional', NULL, 2, true);

  INSERT INTO assessment_questions (id, category_id, question_code, question_text, question_type, max_score, evidence_mode, comment_mode, guidance_note, sort_order, is_active)
  VALUES ('6d797e5c-3e10-40ef-8bd5-56f43e4eedd2', '28004cc6-bd3c-4c62-8187-0554dafc711d', 'ai4', 'Biomass foraged (%)', 'number', 3, 'optional', 'optional', NULL, 3, true);

END $$;