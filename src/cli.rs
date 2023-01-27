use clap::{Parser, Subcommand};

#[derive(Parser, Debug)]
#[clap(version, about, long_about = None, propagate_version = true)]
pub struct Cli {
    #[clap(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    #[clap(about = "Validate syntax and generate AST")]
    Parse {
        #[clap(value_parser, help = "Path to source file")]
        source: String,

        #[clap(
            short,
            long,
            required = false,
            takes_value = false,
            help = "Detailed output"
        )]
        verbose: bool,
    },
    #[clap(about = "Run source file")]
    Run {
        #[clap(value_parser, help = "Path to source file")]
        source: String,

        #[clap(
            short,
            long,
            required = false,
            takes_value = false,
            help = "Detailed output"
        )]
        verbose: bool,

        #[clap(multiple = true)]
        args: Vec<String>,
    },
    Repl {
        #[clap(
        short,
        long,
        required = false,
        takes_value = false,
        help = "Detailed output"
        )]
        verbose: bool,

        #[clap(multiple = true)]
        args: Vec<String>,
    },
}
