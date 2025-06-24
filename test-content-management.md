# Content Management Testing - Post Migration

## Test 3: Content Management (Create, Edit, Delete Pages)

### Prerequisites
1. Navigate to: https://cpeio.online/admin/login
2. Login with admin credentials: `admin` / `StackBlog2025!`

### Test Cases

#### ✅ Test 3.1: Pages List Access
1. **URL**: https://cpeio.online/admin/pages
2. **Expected**: Handlebars-rendered page list with:
   - Search bar at top
   - Table of existing pages
   - "New Page" button
   - Pagination (if applicable)
   - No template errors in console

#### ✅ Test 3.2: Create New Page
1. **URL**: https://cpeio.online/admin/pages/new
2. **Expected**: Page creation form with:
   - Title field (required)
   - Slug field (auto-generated)
   - Description field
   - Content textarea (markdown)
   - Publish settings sidebar
   - SEO settings section
   - Save/publish buttons

3. **Test Actions**:
   ```
   Title: "Test Migration Page"
   Slug: "test-migration-page" (auto-generated)
   Description: "Testing the migrated page editor"
   Content: "# Test Page\n\nThis page was created using the new Handlebars templates!"
   Published: ✓ checked
   ```

4. **Expected Results**:
   - Form submission successful
   - Redirect to pages list or edit page
   - Success notification displayed
   - Page appears in pages list

#### ✅ Test 3.3: Edit Existing Page
1. **URL**: https://cpeio.online/admin/pages/test-migration-page/edit
2. **Expected**: Edit form pre-populated with page data
3. **Test Actions**:
   - Modify title to "Updated Test Page"
   - Add content: "\n\n**Updated:** This page has been edited successfully!"
   - Save changes

4. **Expected Results**:
   - Changes saved successfully
   - Updated content visible in editor
   - "View Live Page" button works (if published)

#### ✅ Test 3.4: Page Search and Filtering
1. **URL**: https://cpeio.online/admin/pages
2. **Test Actions**:
   - Search for "test" in search box
   - Verify filtered results show test page
   - Clear search and verify all pages return

#### ✅ Test 3.5: Delete Page
1. **URL**: https://cpeio.online/admin/pages
2. **Test Actions**:
   - Click delete button (trash icon) for test page
   - Confirm deletion in modal/prompt
   - Verify page removed from list

#### ✅ Test 3.6: Form Validation
1. **URL**: https://cpeio.online/admin/pages/new
2. **Test Actions**:
   - Try to submit with empty title
   - Try to submit with invalid slug characters
   - Verify client-side validation working

#### ✅ Test 3.7: SEO and Metadata
1. **URL**: https://cpeio.online/admin/pages/new
2. **Test Actions**:
   - Fill SEO fields: Meta Title, Meta Description, Tags
   - Save page and verify metadata preserved
   - Check character counters for meta fields

### Browser Console Checks
For each test, verify in browser developer console:
- ✅ No JavaScript errors
- ✅ No template compilation errors
- ✅ No 404 errors for CSS/JS resources
- ✅ CSRF tokens working properly

### Performance Checks
- ✅ Page load times under 2 seconds
- ✅ Form submissions responsive
- ✅ No memory leaks in browser
- ✅ Smooth navigation between pages

### Results Summary
| Test Case | Status | Notes |
|-----------|--------|-------|
| 3.1 Pages List | ⭕ Pending | Test when logged in |
| 3.2 Create Page | ⭕ Pending | Test form functionality |
| 3.3 Edit Page | ⭕ Pending | Test data persistence |
| 3.4 Search/Filter | ⭕ Pending | Test search functionality |
| 3.5 Delete Page | ⭕ Pending | Test deletion workflow |
| 3.6 Form Validation | ⭕ Pending | Test error handling |
| 3.7 SEO Metadata | ⭕ Pending | Test advanced features |

### Critical Success Criteria
- ✅ All pages load without template errors
- ✅ CRUD operations (Create, Read, Update, Delete) work
- ✅ Form validation prevents invalid data
- ✅ Navigation and UI responsive
- ✅ No regression from previous functionality

---

**Status**: Ready for manual testing  
**Priority**: High (Critical for admin functionality)  
**Estimated Time**: 15-20 minutes for complete test suite