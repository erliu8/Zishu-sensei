# Test Fixtures

This directory contains test data fixtures for the Zishu Sensei desktop application test suite.

## 📁 Directory Structure

```
fixtures/
├── adapters/          # Adapter configuration test data
├── characters/        # Character configuration test data
├── workflows/         # Workflow definition test data
├── configs/           # Application configuration test data
└── README.md          # This file
```

## 🎯 Purpose

Fixtures provide consistent, reusable test data for:
- **Unit tests**: Testing individual components with realistic data
- **Integration tests**: Testing component interactions with complete data sets
- **Validation tests**: Testing data validation and error handling
- **Edge case tests**: Testing boundary conditions and special scenarios

## 📋 Fixture Categories

### 1. Adapters (`adapters/`)

Test data for AI model adapters including:

| File | Description | Use Case |
|------|-------------|----------|
| `valid_openai_adapter.json` | Complete OpenAI GPT-4 adapter configuration | Testing soft adapter loading and configuration |
| `valid_claude_adapter.json` | Complete Claude 3 Opus adapter configuration | Testing alternative LLM adapters |
| `hard_adapter_example.json` | Native Rust hard adapter configuration | Testing hard adapter integration |
| `intelligent_adapter_example.json` | Intelligent self-adaptive adapter | Testing intelligent adapter routing |
| `minimal_adapter.json` | Minimal valid adapter with required fields only | Testing minimal requirements |
| `invalid_adapter_missing_required.json` | Invalid adapter missing required fields | Testing validation errors |
| `invalid_adapter_wrong_type.json` | Invalid adapter with wrong field types | Testing type validation |

**Key Features Tested:**
- ✅ Soft/Hard/Intelligent adapter types
- ✅ Adapter capabilities and compatibility
- ✅ Resource requirements
- ✅ Configuration schemas and validation
- ✅ Default configurations
- ✅ Error handling for invalid data

### 2. Characters (`characters/`)

Test data for Live2D character configurations:

| File | Description | Use Case |
|------|-------------|----------|
| `valid_shizuku_character.json` | Complete Shizuku character with all features | Testing full character loading |
| `character_with_advanced_features.json` | Sakura character with advanced features | Testing premium/advanced features |
| `valid_minimal_character.json` | Minimal character configuration | Testing minimal requirements |
| `invalid_character_missing_id.json` | Invalid character without required ID | Testing validation errors |

**Key Features Tested:**
- ✅ Character metadata (id, name, description, avatar)
- ✅ Live2D model paths and configurations
- ✅ Motions and expressions
- ✅ Voice configurations
- ✅ Custom data and metadata
- ✅ Character state management
- ✅ Validation and error handling

### 3. Workflows (`workflows/`)

Test data for workflow definitions and templates:

| File | Description | Use Case |
|------|-------------|----------|
| `simple_greeting_workflow.json` | Simple 3-step greeting workflow | Testing basic workflow execution |
| `complex_chat_workflow.json` | Complete AI chat processing workflow | Testing complex multi-step workflows |
| `parallel_execution_workflow.json` | Workflow with parallel task execution | Testing parallel step execution |
| `workflow_template_data_processing.json` | Reusable workflow template | Testing template instantiation |
| `invalid_workflow_missing_steps.json` | Invalid workflow without steps | Testing validation errors |

**Key Features Tested:**
- ✅ Workflow steps and dependencies
- ✅ Step types (input, transform, api_call, condition, output)
- ✅ Retry configurations and timeout handling
- ✅ Parallel vs sequential execution
- ✅ Triggers (manual, event, schedule)
- ✅ Template parameters and validation
- ✅ Error handling strategies

### 4. Configs (`configs/`)

Test data for application configurations:

| File | Description | Use Case |
|------|-------------|----------|
| `default_app_config.json` | Default application configuration | Testing default settings |
| `custom_user_config.json` | Customized user configuration | Testing user preferences |
| `minimal_config.json` | Minimal valid configuration | Testing minimal requirements |
| `invalid_config_wrong_types.json` | Invalid config with type errors | Testing validation errors |

**Key Features Tested:**
- ✅ Window configuration (size, position, appearance)
- ✅ Character settings (model, scale, interaction)
- ✅ Theme configuration (mode, custom CSS)
- ✅ System settings (auto-start, tray, notifications)
- ✅ AI configuration (adapter, parameters)
- ✅ Privacy settings (data collection, encryption)
- ✅ Performance settings (hardware acceleration, limits)

## 🛠️ Usage in Tests

### Loading Fixtures

```rust
use std::fs;
use serde_json::Value;

// Load a fixture file
fn load_fixture(path: &str) -> Value {
    let fixture_path = format!("tests/fixtures/{}", path);
    let content = fs::read_to_string(&fixture_path)
        .expect(&format!("Failed to read fixture: {}", path));
    serde_json::from_str(&content)
        .expect(&format!("Failed to parse fixture: {}", path))
}

// Example usage
#[test]
fn test_adapter_loading() {
    let adapter_data = load_fixture("adapters/valid_openai_adapter.json");
    // Use adapter_data in your test
}
```

### Creating Test Helpers

```rust
// tests/common/fixtures.rs

use serde_json::Value;
use std::fs;

pub fn load_adapter_fixture(name: &str) -> Value {
    load_fixture(&format!("adapters/{}.json", name))
}

pub fn load_character_fixture(name: &str) -> Value {
    load_fixture(&format!("characters/{}.json", name))
}

pub fn load_workflow_fixture(name: &str) -> Value {
    load_fixture(&format!("workflows/{}.json", name))
}

pub fn load_config_fixture(name: &str) -> Value {
    load_fixture(&format!("configs/{}.json", name))
}

fn load_fixture(relative_path: &str) -> Value {
    let fixture_path = format!("tests/fixtures/{}", relative_path);
    let content = fs::read_to_string(&fixture_path)
        .expect(&format!("Failed to read fixture: {}", fixture_path));
    serde_json::from_str(&content)
        .expect(&format!("Failed to parse fixture: {}", fixture_path))
}
```

## ✅ Best Practices

1. **Realistic Data**: Fixtures should represent realistic use cases
2. **Complete Coverage**: Include both valid and invalid test cases
3. **Edge Cases**: Test boundary conditions and special scenarios
4. **Consistency**: Maintain consistent structure across similar fixtures
5. **Documentation**: Document the purpose and expected behavior of each fixture
6. **Versioning**: Keep fixtures in sync with data model versions
7. **Immutability**: Don't modify fixtures during tests; create copies if needed

## 🔄 Maintenance

### Adding New Fixtures

1. Create the fixture file in the appropriate directory
2. Follow the existing naming convention: `<purpose>_<description>.json`
3. Validate the JSON structure
4. Update this README with the new fixture
5. Add corresponding test cases

### Updating Existing Fixtures

1. Ensure backward compatibility or update all dependent tests
2. Document breaking changes in commit messages
3. Update fixture version numbers if applicable
4. Review all tests using the modified fixture

## 📊 Fixture Statistics

- **Total Adapters**: 7 fixtures (4 valid, 3 invalid/edge cases)
- **Total Characters**: 4 fixtures (3 valid, 1 invalid)
- **Total Workflows**: 5 fixtures (4 valid, 1 invalid)
- **Total Configs**: 4 fixtures (3 valid, 1 invalid)
- **Total Test Cases**: 20+ fixtures covering 50+ scenarios

## 🔍 Testing Scenarios Covered

### Valid Data Scenarios
- ✅ Minimal valid configurations
- ✅ Complete configurations with all optional fields
- ✅ Advanced/premium feature configurations
- ✅ Multiple adapter types (soft, hard, intelligent)
- ✅ Various workflow patterns (sequential, parallel, conditional)

### Invalid Data Scenarios
- ✅ Missing required fields
- ✅ Invalid field types
- ✅ Out-of-range values
- ✅ Invalid references
- ✅ Malformed data structures

### Edge Cases
- ✅ Empty collections
- ✅ Null optional fields
- ✅ Maximum/minimum values
- ✅ Special characters in strings
- ✅ Large data sets

## 📝 Notes

- All timestamps are in Unix epoch format (seconds since 1970-01-01)
- ISO 8601 format is used for datetime strings where applicable
- File paths in fixtures are relative to the application data directory
- Configuration values respect platform-specific defaults
- JSON files are formatted for readability (pretty-printed)

## 🔗 Related Documentation

- [Test Framework Plan](../TEST_FRAMEWORK_PLAN.md)
- [Testing README](../README.md)
- [Common Test Utilities](../common/README.md)
- [Integration Tests](../integration/README.md)

---

**Last Updated**: 2024-10-21  
**Maintained by**: Zishu Team  
**Version**: 1.0.0

