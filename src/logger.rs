use colored::Colorize;
use log::{Level, LevelFilter, Metadata, Record};

struct Logger;

impl log::Log for Logger {
    fn enabled(&self, _metadata: &Metadata) -> bool {
        true
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            let pretty_level = match record.level() {
                Level::Trace => format!("[.]").white(),
                Level::Debug => format!("[d]").white(),
                Level::Info => format!("[i]").bright_green(),
                Level::Warn => format!("[W]").yellow(),
                Level::Error => format!("[E]").red(),
            };
            let format_target = || -> String {
                let s = record.target();
                let last_colon = s
                    .chars()
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rposition(|c| c == ':')
                    .map(|p| p + 1)
                    .unwrap_or(0);
                let sl = &s[last_colon..];
                sl.to_string()
            };
            println!(
                "{} [{:<12}:{:>3}] {}",
                pretty_level,
                format!("{}", format_target()),
                record
                    .line()
                    .map(|i| i.to_string())
                    .unwrap_or("?".to_string()),
                record.args()
            );
        }
    }

    fn flush(&self) {}
}

static LOGGER: Logger = Logger;

pub fn init(level: LevelFilter) {
    log::set_logger(&LOGGER)
        .map(|_| log::set_max_level(level))
        .ok();
}
