SELECT "Id", "Email", "UserName" 
FROM "AspNetUsers" 
WHERE "Email" LIKE 'fixture_%' 
   OR "Email" LIKE 'deleted_%' 
   OR "Email" LIKE '%@test.%' 
   OR "Email" LIKE 'testuser%' 
   OR "Email" LIKE 'stars_test%' 
   OR "Email" LIKE 'admin_created_%' 
   OR "Email" = 'asd@gmial.com';
