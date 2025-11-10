fn main() {
    // Load .env file if it exists
    if let Ok(env_path) = std::env::current_dir() {
        let env_file = env_path.join(".env");
        if env_file.exists() {
            println!("cargo:rerun-if-changed=.env");
            if let Ok(contents) = std::fs::read_to_string(&env_file) {
                for line in contents.lines() {
                    if let Some((key, value)) = line.split_once('=') {
                        let key = key.trim();
                        let value = value.trim();
                        if !key.is_empty() && !key.starts_with('#') {
                            println!("cargo:rustc-env={}={}", key, value);
                        }
                    }
                }
            }
        }
    }
    
    tauri_build::build()
}

