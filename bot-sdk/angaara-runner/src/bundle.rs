//! Unpacks a project zip into the project folder, refusing anything that could escape it.

use std::{
    io::{Cursor, Read},
    path::{Component, Path, PathBuf},
};

use zip::ZipArchive;

#[derive(Debug, Clone, Copy)]
pub struct Limits {
    pub max_bundle_bytes: usize,
    pub max_files: usize,
    pub max_file_bytes: u64,
    pub max_total_bytes: u64,
}

impl Default for Limits {
    fn default() -> Self {
        Self {
            max_bundle_bytes: 20 * 1024 * 1024,
            max_files: 500,
            max_file_bytes: 2 * 1024 * 1024,
            max_total_bytes: 20 * 1024 * 1024,
        }
    }
}

/// Top-level folders a bundle may not write into.
const RESERVED: &[&str] = &["target", ".git", "bot-data"];
/// Survive every upload: the build cache and the bot's saved login and keys.
const KEEP: &[&str] = &["target", "bot-data"];

/// Accepts only plain relative paths like `src/main.rs`.
pub fn safe_relative_path(name: &str) -> Option<PathBuf> {
    if name.is_empty() || name.contains('\\') || name.chars().any(char::is_control) {
        return None;
    }
    let path = Path::new(name);
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(part) => out.push(part),
            _ => return None,
        }
    }
    let first = out.components().next()?.as_os_str().to_str()?;
    if RESERVED.contains(&first) {
        return None;
    }
    Some(out)
}

/// Replaces the project's files (except `target/` and `bot-data/`) with the bundle's.
pub fn extract(bytes: &[u8], project_dir: &Path, limits: Limits) -> Result<usize, String> {
    if bytes.len() > limits.max_bundle_bytes {
        return Err("project bundle is too large".into());
    }
    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|_| "invalid project bundle")?;
    if archive.len() > limits.max_files {
        return Err(format!("too many files (max {})", limits.max_files));
    }

    // Validate everything before touching the disk.
    let mut entries = Vec::new();
    let mut total = 0u64;
    for i in 0..archive.len() {
        let file = archive.by_index(i).map_err(|_| "invalid project bundle")?;
        if file.is_dir() {
            continue;
        }
        if file.is_symlink() {
            return Err(format!("symlinks are not allowed: {}", file.name()));
        }
        let path = safe_relative_path(file.name())
            .ok_or_else(|| format!("unsafe path in bundle: {}", file.name()))?;
        if file.size() > limits.max_file_bytes {
            return Err(format!("file too large: {}", file.name()));
        }
        total += file.size();
        if total > limits.max_total_bytes {
            return Err("project is too large".into());
        }
        entries.push((i, path));
    }

    ensure_real_dir(project_dir)?;
    clean_project(project_dir)?;

    for (i, path) in &entries {
        let mut file = archive.by_index(*i).map_err(|_| "invalid project bundle")?;
        let mut contents = Vec::new();
        // Read one byte past the limit so a lying size header can't smuggle in a zip bomb.
        (&mut file)
            .take(limits.max_file_bytes + 1)
            .read_to_end(&mut contents)
            .map_err(|_| "could not read bundle")?;
        if contents.len() as u64 > limits.max_file_bytes {
            return Err(format!("file too large: {}", path.display()));
        }
        let target = project_dir.join(path);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        std::fs::write(&target, contents).map_err(|e| e.to_string())?;
    }
    Ok(entries.len())
}

/// Zips a project's text files for sending back, skipping the `RESERVED` folders,
/// symlinks and binary files. Uses the same limits as uploads.
pub fn pack(project_dir: &Path, limits: Limits) -> Result<Vec<u8>, String> {
    let meta = std::fs::symlink_metadata(project_dir).map_err(|_| "project not found")?;
    if !meta.is_dir() {
        return Err("project not found".into());
    }
    let mut files = Vec::new();
    collect_files(project_dir, Path::new(""), &mut files, limits)?;
    files.sort();

    let mut out = Cursor::new(Vec::new());
    let mut writer = zip::ZipWriter::new(&mut out);
    let options =
        zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
    let mut total = 0u64;
    for rel in files {
        let contents = std::fs::read(project_dir.join(&rel)).map_err(|e| e.to_string())?;
        if std::str::from_utf8(&contents).is_err() {
            continue;
        }
        total += contents.len() as u64;
        if total > limits.max_total_bytes {
            return Err("project is too large".into());
        }
        let name = rel
            .to_str()
            .ok_or("file name is not UTF-8")?
            .replace('\\', "/");
        writer
            .start_file(name, options)
            .map_err(|e| e.to_string())?;
        std::io::Write::write_all(&mut writer, &contents).map_err(|e| e.to_string())?;
    }
    writer.finish().map_err(|e| e.to_string())?;
    Ok(out.into_inner())
}

fn collect_files(
    root: &Path,
    rel: &Path,
    files: &mut Vec<PathBuf>,
    limits: Limits,
) -> Result<(), String> {
    for entry in std::fs::read_dir(root.join(rel)).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = rel.join(entry.file_name());
        let top_level = rel.as_os_str().is_empty();
        if top_level && RESERVED.iter().any(|r| entry.file_name() == *r) {
            continue;
        }
        let meta = std::fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
        if meta.is_dir() {
            collect_files(root, &path, files, limits)?;
        } else if meta.is_file() && meta.len() <= limits.max_file_bytes {
            if files.len() >= limits.max_files {
                return Err(format!("too many files (max {})", limits.max_files));
            }
            files.push(path);
        }
    }
    Ok(())
}

/// Creates the folder if needed and refuses anything that isn't a real directory.
pub fn ensure_real_dir(dir: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let meta = std::fs::symlink_metadata(dir).map_err(|e| e.to_string())?;
    if !meta.is_dir() {
        return Err("project folder is not a real directory".into());
    }
    Ok(())
}

/// Removes everything but the `KEEP` folders. Symlinks are removed, never followed.
fn clean_project(dir: &Path) -> Result<(), String> {
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if KEEP.iter().any(|k| entry.file_name() == *k) {
            continue;
        }
        let meta = std::fs::symlink_metadata(entry.path()).map_err(|e| e.to_string())?;
        let result = if meta.is_dir() {
            std::fs::remove_dir_all(entry.path())
        } else {
            std::fs::remove_file(entry.path())
        };
        result.map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    fn zip_of(files: &[(&str, &str)]) -> Vec<u8> {
        let mut out = Cursor::new(Vec::new());
        let mut writer = zip::ZipWriter::new(&mut out);
        let options =
            SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
        for (name, body) in files {
            writer.start_file(*name, options).unwrap();
            writer.write_all(body.as_bytes()).unwrap();
        }
        writer.finish().unwrap();
        out.into_inner()
    }

    #[test]
    fn path_rules() {
        assert!(safe_relative_path("src/main.rs").is_some());
        assert!(safe_relative_path(".env").is_some());
        assert!(safe_relative_path("../escape.rs").is_none());
        assert!(safe_relative_path("src/../../escape.rs").is_none());
        assert!(safe_relative_path("/etc/passwd").is_none());
        assert!(safe_relative_path("target/debug/evil").is_none());
        assert!(safe_relative_path(".git/hooks/pre-commit").is_none());
        assert!(safe_relative_path("bot-data/session.json").is_none());
        assert!(safe_relative_path("a\\b").is_none());
        assert!(safe_relative_path("").is_none());
    }

    #[test]
    fn extracts_and_keeps_build_cache() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("target")).unwrap();
        std::fs::write(dir.path().join("target/cache"), "keep").unwrap();
        std::fs::create_dir_all(dir.path().join("bot-data")).unwrap();
        std::fs::write(dir.path().join("bot-data/session.json"), "keep").unwrap();
        std::fs::write(dir.path().join("old.rs"), "stale").unwrap();

        let bundle = zip_of(&[("Cargo.toml", "[package]"), ("src/main.rs", "fn main() {}")]);
        assert_eq!(extract(&bundle, dir.path(), Limits::default()), Ok(2));
        assert_eq!(
            std::fs::read_to_string(dir.path().join("src/main.rs")).unwrap(),
            "fn main() {}"
        );
        assert!(dir.path().join("target/cache").exists());
        assert!(dir.path().join("bot-data/session.json").exists());
        assert!(!dir.path().join("old.rs").exists());
    }

    #[test]
    fn rejects_escapes_without_writing_anything() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("keep.rs"), "untouched").unwrap();
        let bundle = zip_of(&[("ok.rs", "x"), ("../evil.rs", "x")]);
        assert!(extract(&bundle, dir.path(), Limits::default()).is_err());
        assert!(
            dir.path().join("keep.rs").exists(),
            "validation must happen before cleaning"
        );
        assert!(!dir.path().parent().unwrap().join("evil.rs").exists());
    }

    #[test]
    fn enforces_limits() {
        let dir = tempfile::tempdir().unwrap();
        let limits = Limits {
            max_files: 1,
            ..Limits::default()
        };
        assert!(extract(&zip_of(&[("a", "1"), ("b", "2")]), dir.path(), limits).is_err());
        let limits = Limits {
            max_file_bytes: 3,
            ..Limits::default()
        };
        assert!(extract(&zip_of(&[("a", "1234")]), dir.path(), limits).is_err());
        assert!(extract(b"not a zip", dir.path(), Limits::default()).is_err());
    }

    #[test]
    fn pack_round_trips_and_skips_reserved_and_binary() {
        let dir = tempfile::tempdir().unwrap();
        let bundle = zip_of(&[("Cargo.toml", "[package]"), ("src/main.rs", "fn main() {}")]);
        extract(&bundle, dir.path(), Limits::default()).unwrap();
        std::fs::create_dir_all(dir.path().join("target")).unwrap();
        std::fs::write(dir.path().join("target/big"), "cache").unwrap();
        std::fs::create_dir_all(dir.path().join("bot-data")).unwrap();
        std::fs::write(dir.path().join("bot-data/session.json"), "secret").unwrap();
        std::fs::write(dir.path().join("logo.png"), [0xff, 0xfe, 0x00]).unwrap();

        let packed = pack(dir.path(), Limits::default()).unwrap();
        let mut archive = ZipArchive::new(Cursor::new(packed)).unwrap();
        let mut names: Vec<_> = archive.file_names().map(str::to_owned).collect();
        names.sort();
        assert_eq!(names, ["Cargo.toml", "src/main.rs"]);
        let mut main = String::new();
        archive
            .by_name("src/main.rs")
            .unwrap()
            .read_to_string(&mut main)
            .unwrap();
        assert_eq!(main, "fn main() {}");
    }

    #[cfg(unix)]
    #[test]
    fn cleaning_removes_symlinks_without_following_them() {
        let outside = tempfile::tempdir().unwrap();
        std::fs::write(outside.path().join("precious"), "safe").unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::os::unix::fs::symlink(outside.path(), dir.path().join("link")).unwrap();

        extract(&zip_of(&[("a.rs", "x")]), dir.path(), Limits::default()).unwrap();
        assert!(!dir.path().join("link").exists());
        assert!(outside.path().join("precious").exists());
    }
}
