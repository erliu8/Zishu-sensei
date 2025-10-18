/**
 * Adapter Service Integration Test
 * 
 * This file demonstrates the complete integration between frontend and backend.
 */

import { AdapterService } from '../services/adapter';

// Test function to verify all adapter service methods
export const testAdapterIntegration = async () => {
  console.log('🧪 Testing Adapter Service Integration...');

  try {
    // Test 1: Get installed adapters
    console.log('\n1. Testing getAdapters...');
    const adapters = await AdapterService.getAdapters();
    console.log('✅ Installed adapters:', adapters.length);

    // Test 2: Search adapters in marketplace
    console.log('\n2. Testing searchAdapters...');
    const searchResults = await AdapterService.searchAdapters({
      query: 'test',
      page: 1,
      page_size: 5,
    });
    console.log('✅ Search results:', searchResults.total, 'adapters found');

    // Test 3: Get adapter details (if any adapters exist)
    if (adapters.length > 0) {
      const firstAdapter = adapters[0];
      console.log('\n3. Testing getAdapterDetails...');
      const details = await AdapterService.getAdapterDetails(firstAdapter.name);
      console.log('✅ Adapter details:', details.name, details.version);

      // Test 4: Get adapter configuration
      console.log('\n4. Testing getAdapterConfig...');
      const config = await AdapterService.getAdapterConfig(firstAdapter.name);
      console.log('✅ Adapter config:', Object.keys(config).length, 'settings');

      // Test 5: Get adapter capabilities
      console.log('\n5. Testing getAdapterCapabilities...');
      const capabilities = await AdapterService.getAdapterCapabilities(firstAdapter.name);
      console.log('✅ Adapter capabilities:', capabilities.length, 'capabilities');
    }

    // Test 6: Get system info
    console.log('\n6. Testing getSystemInfo...');
    const systemInfo = await AdapterService.getSystemInfo();
    console.log('✅ System info:', systemInfo.os, systemInfo.arch);

    // Test 7: Get adapter marketplace info
    console.log('\n7. Testing getAdapterMarketplaceInfo...');
    const marketplaceInfo = await AdapterService.getAdapterMarketplaceInfo();
    console.log('✅ Marketplace info:', marketplaceInfo.total_adapters, 'total adapters');

    console.log('\n🎉 All tests passed! Adapter service integration is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
};

// Test function for adapter operations (requires actual adapters)
export const testAdapterOperations = async () => {
  console.log('🔧 Testing Adapter Operations...');

  try {
    // Get adapters first
    const adapters = await AdapterService.getAdapters();
    
    if (adapters.length === 0) {
      console.log('⚠️  No adapters installed, skipping operation tests');
      return;
    }

    const testAdapter = adapters[0];
    console.log(`\nTesting operations on adapter: ${testAdapter.name}`);

    // Test load/unload operations
    if (testAdapter.status === 'unloaded') {
      console.log('\n1. Testing loadAdapter...');
      await AdapterService.loadAdapter(testAdapter.name);
      console.log('✅ Adapter loaded successfully');
    }

    // Test configuration update
    console.log('\n2. Testing updateAdapterConfig...');
    await AdapterService.updateAdapterConfig({
      adapter_id: testAdapter.name,
      config: { test_setting: 'test_value' },
      merge: true,
    });
    console.log('✅ Configuration updated successfully');

    // Test unload operation
    console.log('\n3. Testing unloadAdapter...');
    await AdapterService.unloadAdapter(testAdapter.name);
    console.log('✅ Adapter unloaded successfully');

    console.log('\n🎉 All operation tests passed!');

  } catch (error) {
    console.error('❌ Operation test failed:', error);
    throw error;
  }
};

// Utility function to run all tests
export const runAllTests = async () => {
  try {
    await testAdapterIntegration();
    await testAdapterOperations();
    console.log('\n🚀 All integration tests completed successfully!');
  } catch (error) {
    console.error('\n💥 Integration tests failed:', error);
    process.exit(1);
  }
};

// Export for use in other files
export default {
  testAdapterIntegration,
  testAdapterOperations,
  runAllTests,
};
