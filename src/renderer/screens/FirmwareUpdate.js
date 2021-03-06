// -*- mode: js-jsx -*-
/* Bazecor -- Kaleidoscope Command Center
 * Copyright (C) 2018, 2019  Keyboardio, Inc.
 * Copyright (C) 2019, 2020  DygmaLab SE
 *
 * This program is free software: you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free Software
 * Foundation, version 3.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import React from "react";
import Electron from "electron";
import path from "path";
import fs from "fs";
import { version } from "../../../package.json";

import Focus from "../../api/focus";
import FlashRaise from "../../api/flash";

import BuildIcon from "@material-ui/icons/Build";
import Button from "@material-ui/core/Button";
import Card from "@material-ui/core/Card";
import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import Divider from "@material-ui/core/Divider";
import ExploreIcon from "@material-ui/icons/ExploreOutlined";
import FormControl from "@material-ui/core/FormControl";
import Input from "@material-ui/core/Input";
import InputLabel from "@material-ui/core/InputLabel";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import MenuItem from "@material-ui/core/MenuItem";
import Portal from "@material-ui/core/Portal";
import Select from "@material-ui/core/Select";
import Grid from "@material-ui/core/Grid";
import SettingsBackupRestoreIcon from "@material-ui/icons/SettingsBackupRestore";
import Typography from "@material-ui/core/Typography";
import { withStyles } from "@material-ui/core/styles";

import { withSnackbar } from "notistack";

import { getStaticPath } from "../config";
import SaveChangesButton from "../components/SaveChangesButton";
import CustomDialog from "../components/CustomDialog";
import i18n from "../i18n";

const styles = theme => ({
  root: {
    display: "flex",
    justifyContent: "center"
  },
  card: {
    margin: theme.spacing.unit * 4,
    maxWidth: "50%"
  },
  grow: {
    flexGrow: 1
  },
  dropdown: {
    display: "flex",
    minWidth: "15em"
  },
  custom: {
    marginTop: "auto",
    marginBottom: "auto"
  },
  repo: {
    textAlign: "center"
  },
  firmwareSelect: {
    marginLeft: theme.spacing.unit * 2
  },
  grid: {
    width: "70%"
  },
  img: {
    width: "100%"
  },
  paper: {
    color: theme.palette.getContrastText(theme.palette.background.paper),
    marginBottom: theme.spacing.unit * 2
  }
});

class FirmwareUpdate extends React.Component {
  constructor(props) {
    super(props);

    let focus = new Focus();
    this.fleshRaise = null;
    this.isDevelopment = process.env.NODE_ENV !== "production";

    this.state = {
      firmwareFilename: "",
      selected: "default",
      device: props.device || focus.device,
      confirmationOpen: false,
      countdown: null,
      buttonText: {
        "": "Uploading ...",
        3: "Start countdown",
        2: "Wait",
        1: "Wait",
        0: "Press"
      },
      versions: null
    };
  }

  componentDidMount() {
    const focus = new Focus();
    let versions;

    focus.command("version").then(v => {
      if (!v) return;
      let parts = v.split(" ");
      versions = {
        bazecor: parts[0],
        kaleidoscope: parts[1],
        firmware: parts[2]
      };

      this.setState({ versions: versions });
    });
  }

  selectFirmware = event => {
    this.setState({ selected: event.target.value });
    if (event.target.value != "custom") {
      return this.setState({ firmwareFilename: "" });
    }

    let files = Electron.remote.dialog.showOpenDialog({
      title: i18n.firmwareUpdate.dialog.selectFirmware,
      filters: [
        {
          name: i18n.firmwareUpdate.dialog.firmwareFiles,
          extensions: ["hex"]
        },
        {
          name: i18n.firmwareUpdate.dialog.allFiles,
          extensions: ["*"]
        }
      ]
    });
    files.then(result => {
      this.setState({ firmwareFilename: result.filePaths[0] });
    });
  };

  _defaultFirmwareFilename = () => {
    const { vendor, product } = this.state.device.device.info;
    const cVendor = vendor.replace("/", ""),
      cProduct = product.replace("/", "");
    return path.join(getStaticPath(), cVendor, cProduct, "default.hex");
  };
  _experimentalFirmwareFilename = () => {
    const { vendor, product } = this.state.device.device.info;
    const cVendor = vendor.replace("/", ""),
      cProduct = product.replace("/", "");
    return path.join(getStaticPath(), cVendor, cProduct, "experimental.hex");
  };

  _flash = async () => {
    let focus = new Focus();
    let filename;
    const delay = ms => new Promise(res => setTimeout(res, ms));

    if (this.state.selected == "default") {
      filename = this._defaultFirmwareFilename();
    } else if (this.state.selected == "experimental") {
      filename = this._experimentalFirmwareFilename();
    } else {
      filename = this.state.firmwareFilename;
    }
    if (this.state.device.device.info.product === "Raise") {
      let count = setInterval(() => {
        const { countdown } = this.state;
        countdown === 0
          ? clearInterval(count)
          : this.setState({ countdown: countdown - 1 });
      }, 1000);
      await delay(3000);
      if (!focus.device.bootloader) {
        await this.fleshRaise.resetKeyboard(focus._port);
      }
      this.setState({ countdown: "" });
    }

    try {
      if (focus.device.bootloader) {
        this.fleshRaise.currentPort = this.props.device;
      }
      await focus.close();
      return await this.state.device.device.flash(
        focus._port,
        filename,
        this.fleshRaise
      );
    } catch (e) {
      console.error(e);
    }
  };

  upload = async () => {
    await this.props.toggleFlashing();

    try {
      await this._flash();
    } catch (e) {
      console.error(e);
      const action = key => (
        <React.Fragment>
          <Button
            color="inherit"
            onClick={() => {
              const shell = Electron.remote && Electron.remote.shell;
              shell.openExternal("https://www.dygma.com/contact/");
              this.props.closeSnackbar(key);
            }}
          >
            Troubleshooting
          </Button>
          <Button
            color="inherit"
            onClick={() => {
              this.props.closeSnackbar(key);
            }}
          >
            Dismiss
          </Button>
        </React.Fragment>
      );
      this.props.enqueueSnackbar(
        this.state.device.device.info.product === "Raise"
          ? e.message
          : i18n.firmwareUpdate.flashing.error,
        {
          variant: "error",
          action
        }
      );
      this.props.toggleFlashing();
      this.props.onDisconnect();
      this.setState({ confirmationOpen: false });
      return;
    }

    return new Promise(resolve => {
      setTimeout(() => {
        this.props.enqueueSnackbar(i18n.firmwareUpdate.flashing.success, {
          variant: "success"
        });

        this.props.toggleFlashing();
        this.props.onDisconnect();
        this.setState({ confirmationOpen: false });
        resolve();
      }, 1000);
    });
  };

  uploadRaise = async () => {
    let focus = new Focus();
    this.setState({ confirmationOpen: true, isBeginUpdate: true });
    try {
      this.fleshRaise = new FlashRaise(this.props.device);
      if (!focus.device.bootloader) {
        await this.fleshRaise.backupSettings();
      }
      this.setState({ countdown: 3 });
    } catch (e) {
      console.error(e);
      this.props.enqueueSnackbar(e.message, {
        variant: "error",
        action: (
          <Button
            variant="contained"
            onClick={() => {
              const shell = Electron.remote && Electron.remote.shell;
              shell.openExternal(
                "https://github.com/Dygmalab/Bazecor/wiki/Troubleshooting"
              );
            }}
          >
            Troubleshooting
          </Button>
        )
      });
      this.setState({ confirmationOpen: false });
    }
  };

  cancelDialog = () => {
    this.setState({ confirmationOpen: false });
  };

  render() {
    const { classes } = this.props;
    const {
      firmwareFilename,
      buttonText,
      countdown,
      isBeginUpdate,
      versions
    } = this.state;

    let filename = null;
    if (firmwareFilename) {
      filename = firmwareFilename.split(/[\\/]/);
      filename = filename[filename.length - 1];
    }

    const defaultFirmwareItemText = i18n.formatString(
      i18n.firmwareUpdate.defaultFirmware,
      version
    );
    const defaultFirmwareItem = (
      <MenuItem value="default" selected={this.state.selected == "default"}>
        <ListItemIcon>
          <SettingsBackupRestoreIcon />
        </ListItemIcon>
        <ListItemText
          primary={defaultFirmwareItemText}
          secondary={i18n.firmwareUpdate.defaultFirmwareDescription}
        />
      </MenuItem>
    );
    let hasDefaultFirmware = true;
    try {
      fs.accessSync(this._defaultFirmwareFilename(), fs.constants.R_OK);
    } catch (_) {
      hasDefaultFirmware = false;
    }

    const experimentalFirmwareItemText = i18n.formatString(
      i18n.firmwareUpdate.experimentalFirmware,
      version
    );
    const experimentalFirmwareItem = (
      <MenuItem
        value="experimental"
        selected={this.state.selected == "experimental"}
      >
        <ListItemIcon>
          <ExploreIcon />
        </ListItemIcon>
        <ListItemText
          primary={experimentalFirmwareItemText}
          secondary={i18n.firmwareUpdate.experimentalFirmwareDescription}
        />
      </MenuItem>
    );
    let hasExperimentalFirmware = true;

    try {
      fs.accessSync(this._experimentalFirmwareFilename(), fs.constants.R_OK);
    } catch (_) {
      hasExperimentalFirmware = false;
    }

    const firmwareSelect = (
      <FormControl className={classes.firmwareSelect}>
        <InputLabel shrink htmlFor="selected-firmware">
          {i18n.firmwareUpdate.selected}
        </InputLabel>
        <Select
          classes={{ select: classes.dropdown }}
          value={this.state.selected}
          input={<Input id="selected-firmware" />}
          onChange={this.selectFirmware}
        >
          {hasDefaultFirmware && defaultFirmwareItem}
          {hasExperimentalFirmware && experimentalFirmwareItem}
          <MenuItem selected={this.state.selected == "custom"} value="custom">
            <ListItemIcon className={classes.custom}>
              <BuildIcon />
            </ListItemIcon>
            <ListItemText
              primary={i18n.firmwareUpdate.custom}
              secondary={filename}
            />
          </MenuItem>
        </Select>
      </FormControl>
    );

    const focus = new Focus();
    const dialogChildren = (
      <React.Fragment>
        <div className={classes.paper}>
          <ol>
            <li>{"Make sure the LEDs on your Raise are on Rainbow mode."}</li>
            <li>
              {`Press "Start Countdown". When the countdown finishes, `}
              <strong>{"press and hold"}</strong>
              {" the Escape key. This will start the update process."}
            </li>
            <li>
              {
                "After the countdown finishes, the Neuron's light should start a blue pulsing pattern, followed by a quick flashing of multiple colors."
              }
            </li>
            <li>
              {
                "When it finishes, the keyboard lights will go back to your default color mode. At this point, you should "
              }
              <strong>{"release the Escape key"}</strong>.
            </li>
          </ol>
        </div>
        {focus.device && !focus.device.bootloader && (
          <Grid container direction="row" justify="center">
            <Grid item className={classes.grid}>
              <img
                src={
                  this.isDevelopment
                    ? "./press_esc.png"
                    : path.join(getStaticPath(), "press_esc.png")
                }
                className={classes.img}
                alt="press_esc"
              />
            </Grid>
          </Grid>
        )}
      </React.Fragment>
    );

    let currentlyRunning;
    if (versions) {
      currentlyRunning = (
        <React.Fragment>
          <CardContent>
            <Typography component="p" gutterBottom>
              {"Your Raise is currently running version "}
              <strong>{versions.bazecor}</strong>
              {" of the firmware."}
            </Typography>
          </CardContent>
          <Divider variant="middle" />
        </React.Fragment>
      );
    }

    return (
      <div className={classes.root}>
        <Portal container={this.props.titleElement}>
          {i18n.app.menu.firmwareUpdate}
        </Portal>
        <Card className={classes.card}>
          <CardContent>
            <Typography component="p" gutterBottom>
              {
                "To install new features on your Raise, we would need to update the firmware. By clicking on the Update button, Bazecor will install a new version of your keyboard's firmware. This will overwrite your previous firmware."
              }
            </Typography>
            <Typography component="p" gutterBottom>
              {"To correctly update the firmware, your Raise has to be on "}
              <strong>{"LED Rainbow"}</strong>
              {" mode."}
            </Typography>
            <Typography component="p" gutterBottom>
              {
                "To put your Raise on LED Rainbow mode, toggle through the LED Next key. If you are using the default layers, the LED Next key is assigned to the Dygma key on the right side of the keyboard."
              }
            </Typography>
          </CardContent>
          <Divider variant="middle" />
          {currentlyRunning}
          <CardActions>
            {firmwareSelect}
            <div className={classes.grow} />
            <SaveChangesButton
              icon={<CloudUploadIcon />}
              onClick={
                this.state.device.device.info.product === "Raise"
                  ? this.uploadRaise
                  : this.upload
              }
              successMessage={i18n.firmwareUpdate.flashing.buttonSuccess}
              isBeginUpdate={isBeginUpdate}
            >
              {i18n.firmwareUpdate.flashing.button}
            </SaveChangesButton>
          </CardActions>
        </Card>
        <CustomDialog
          title={i18n.firmwareUpdate.raise.reset}
          open={this.state.confirmationOpen}
          buttonText={countdown > -1 ? buttonText[countdown] : buttonText[""]}
          handleClose={this.cancelDialog}
          upload={this.upload}
          countdown={countdown}
          disabled={countdown !== 3}
        >
          {dialogChildren}
        </CustomDialog>
      </div>
    );
  }
}

export default withSnackbar(withStyles(styles)(FirmwareUpdate));
