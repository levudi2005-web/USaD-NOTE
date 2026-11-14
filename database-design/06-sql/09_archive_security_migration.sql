-- Apply only after confirming the target is the NOTE database and backing it up.
USE `note_db`;

DELIMITER $$

CREATE OR REPLACE TRIGGER `trg_archives_calc_ratio_before_insert`
BEFORE INSERT ON `archives`
FOR EACH ROW
BEGIN
  IF NEW.file_size > 0 THEN
    SET NEW.max_ratio = ROUND(NEW.uncompressed_size / NEW.file_size, 2);
  END IF;

  IF NEW.max_ratio > 50.00 THEN
    SET NEW.scan_status = 'rejected';
  END IF;
END$$

DELIMITER ;
