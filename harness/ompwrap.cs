using System;
using System.Diagnostics;

// Thin launcher: the OMP Desktop settings point at THIS executable.
// It starts node with the tee proxy, passing every argument through unchanged,
// and hands the child the same console handles (ConPTY) it was given, so the
// engine still sees a real terminal.
class OmpWrap
{
    static int Main(string[] args)
    {
        const string node = @"C:\Program Files\nodejs\node.exe";
        const string script = @"C:\Users\micha\.omp\maintenance\omp-tee.js";

        var psi = new ProcessStartInfo();
        psi.FileName = node;
        psi.UseShellExecute = false;
        psi.WorkingDirectory = Environment.CurrentDirectory;

        var sb = new System.Text.StringBuilder();
        sb.Append('"').Append(script).Append('"');
        foreach (var a in args)
        {
            sb.Append(' ');
            sb.Append('"').Append(a.Replace("\"", "\\\"")).Append('"');
        }
        psi.Arguments = sb.ToString();

        var p = Process.Start(psi);
        p.WaitForExit();
        return p.ExitCode;
    }
}
